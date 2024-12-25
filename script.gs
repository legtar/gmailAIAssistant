// Configuration
const OPENAI_API_KEY = ''; // Замените на ваш ключ OpenAI API
const RESUME_DRIVE_ID = '13VbtkmfCdk6dQS0i6BeRUcykAtYZjwsq'; // ID of your resume in Google Drive
const MAX_EMAIL_AGE_DAYS = 2; // Only process emails newer than this

const MAX_EMAILS_PER_RUN = 20; // Limit emails processed per run

// Quota management
const QUOTA_SHEET_NAME = 'QuotaTracking';
const DAILY_GMAIL_QUOTA = 20000; // Gmail's daily quota

function processUnreadEmails() {
  if (!checkQuota()) {
    Logger.log('Daily quota reached. Stopping execution.');
    return;
  }

  try {
    // Get only newest unread threads to minimize API calls
    const threads = GmailApp.search('in:inbox is:unread -in:spam -from:me', 0, MAX_EMAILS_PER_RUN);
    let processedCount = 0;
    
    for (const thread of threads) {
      // Check quota before each operation
      if (!checkQuota()) {
        Logger.log('Quota limit reached during execution. Stopping.');
        break;
      }

      if (processedCount >= MAX_EMAILS_PER_RUN) {
        Logger.log('Reached maximum emails per run limit.');
        break;
      }

      processThread(thread);
      processedCount++;
      
      // Add delay between processing
      Utilities.sleep(1000);
    }
    
    updateQuotaUsage(processedCount * 10); // Approximate API calls per thread
    Logger.log(`Processed ${processedCount} emails`);
    
  } catch (error) {
    Logger.log('Error in processing: ' + error.toString());
    throw error;
  }
}

function processThread(thread) {
  // Get messages efficiently
  const messages = thread.getMessages();
  if (messages.length === 0) return;
  
  const message = messages[0];
  const emailAge = (new Date() - message.getDate()) / (1000 * 60 * 60 * 24);
  
  if (emailAge > MAX_EMAIL_AGE_DAYS) return;
  
  // Cache message details to minimize API calls
  const messageDetails = {
    from: message.getFrom(),
    subject: message.getSubject(),
    body: message.getPlainBody(),
    date: message.getDate()
  };
  
  // Check if this is a new recruiting thread
  //if (!isNewRecruitingThread(thread, messageDetails)) {
  //  return;
  //}
  processMessage(message);
  //handleRecruitingEmail(message, messageDetails);
}

function checkQuota() {
  const quotaSheet = getQuotaSheet();
  const today = new Date().toDateString();
  const lastRow = quotaSheet.getLastRow();
  
  if (lastRow > 1) {
    const lastDate = quotaSheet.getRange(lastRow, 1).getValue().toDateString();
    const usageToday = lastDate === today ? 
      quotaSheet.getRange(lastRow, 2).getValue() : 0;
    
    return usageToday < DAILY_GMAIL_QUOTA;
  }
  
  return true;
}

function updateQuotaUsage(calls) {
  const quotaSheet = getQuotaSheet();
  const today = new Date();
  const lastRow = quotaSheet.getLastRow();
  
  if (lastRow > 1 && 
      quotaSheet.getRange(lastRow, 1).getValue().toDateString() === today.toDateString()) {
    const currentUsage = quotaSheet.getRange(lastRow, 2).getValue();
    quotaSheet.getRange(lastRow, 2).setValue(currentUsage + calls);
  } else {
    quotaSheet.appendRow([today, calls]);
  }
}

function getQuotaSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(QUOTA_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(QUOTA_SHEET_NAME);
    sheet.appendRow(['Date', 'API Calls']);
  }
  
  return sheet;
}

function handleRecruitingEmail(message, messageDetails) {
  try {
    const analysis = analyzeEmail(
      messageDetails.from,
      messageDetails.subject,
      messageDetails.body
    );
    
    if (analysis.isRecruitingEmail && analysis.isFirstContact) {
      const response = generateResponse(analysis, messageDetails);
      
      if (response.shouldSendResume) {
        sendResponseWithResume(message, response.text);
      } else {
        sendResponse(message, response.text);
      }
      
      logInteraction(messageDetails.from, messageDetails.subject, analysis);
    }
  } catch (error) {
    Logger.log('Error handling recruiting email: ' + error.toString());
  }
}

// Test function with quota awareness
function testWithRecentEmail() {
  if (!checkQuota()) {
    Logger.log('Cannot run test - daily quota reached');
    return;
  }
  
  try {
    const threads = GmailApp.search('is:unread -in:spam -from:me', 0, 1);
    if (threads.length === 0) {
      Logger.log('No unread emails found for testing');
      return;
    }
    
    Logger.log('=== Starting Test ===');
    processThread(threads[0]);
    updateQuotaUsage(10);
    Logger.log('=== Test Complete ===');
    
  } catch (error) {
    Logger.log('Test error: ' + error.toString());
  }
}

// Create menu with quota information
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Email Assistant')
    .addItem('Process Unread Emails', 'processUnreadEmails')
    .addItem('Test With Recent Email', 'testWithRecentEmail')
    .addItem('Check Quota Usage', 'showQuotaStatus')
    .addToUi();
}

function showQuotaStatus() {
  const quotaSheet = getQuotaSheet();
  const today = new Date().toDateString();
  const lastRow = quotaSheet.getLastRow();
  
  let usageToday = 0;
  if (lastRow > 1) {
    const lastDate = quotaSheet.getRange(lastRow, 1).getValue().toDateString();
    if (lastDate === today) {
      usageToday = quotaSheet.getRange(lastRow, 2).getValue();
    }
  }
  
  const remaining = DAILY_GMAIL_QUOTA - usageToday;
  
  SpreadsheetApp.getUi().alert(
    'Quota Status\n\n' +
    `Used today: ${usageToday}\n` +
    `Remaining: ${remaining}\n` +
    `Percentage used: ${(usageToday/DAILY_GMAIL_QUOTA*100).toFixed(1)}%`
  );
}

function isNewRecruitingThread(thread) {
  const messages = thread.getMessages();
  
  // Check if this is first message in thread
  if (messages.length > 1) {
    return false;
  }
  
  const message = messages[0];
  const sender = message.getFrom();
  
  // Search for previous threads from this sender
  const query = `from:(${sender})`;
  const previousThreads = GmailApp.search(query);
  
  // Filter threads to only include those older than this one
  const olderThreads = previousThreads.filter(t => 
    t.getLastMessageDate() < thread.getLastMessageDate()
  );
  
  // If we have older threads from this sender, it's not a new contact
  if (olderThreads.length > 0) {
    return false;
  }
  
  return true;
}

function sendResponse(message, responseText) {
  const subject = `Re: ${message.getSubject()}`;
  GmailApp.sendEmail(
    message.getFrom(),
    subject,
    responseText,
    {
      from: message.getTo(),
      threadId: message.getThread().getId()
    }
  );
}

function truncateText(text, maxLength = 4000) {
  if (text.length <= maxLength) return text;
  
  // Try to truncate at a paragraph break
  let truncated = text.substring(0, maxLength);
  const lastParagraph = truncated.lastIndexOf('\n\n');
  
  if (lastParagraph > maxLength * 0.8) { // If we can get a clean paragraph break
    truncated = text.substring(0, lastParagraph);
  } else {
    // Otherwise truncate at the last sentence
    const lastSentence = truncated.match(/[.!?]\s/g);
    if (lastSentence && lastSentence.index > maxLength * 0.8) {
      truncated = text.substring(0, lastSentence.index + 1);
    }
  }
  
  return truncated + "\n\n[Content truncated due to length...]";
}


function analyzeEmail(from, subject, body) {

  const truncatedBody = truncateText(body);

  const prompt = `Analyze this email and determine its type and characteristics:
  From: ${from}
  Subject: ${subject}
  Body: ${truncatedBody}
  
  Return a JSON object with:
  {
    "emailType": string, // One of: "recruiting", "newsletter", "marketing", "other"
    "isRecruitingEmail": boolean,
    "isFirstContact": boolean,
    "isNewsletter": boolean,
    "confidence": number, // 0-1 score
    "analysis": {
      "jobTitle": string | null,
      "companyName": string | null,
      "shouldSendResume": boolean,
      "keyPoints": string[],
      "recruitingPlatform": string | null,
      "automatedSender": boolean, // Is this from an automated system?
      "newsletterIndicators": {
        "hasUnsubscribeLink": boolean,
        "isBulkMailing": boolean,
        "isMarketing": boolean
      }
    },
    "recommendedAction": string // "respond", "mark_read", "ignore", "archive"
  }

  Consider these factors:
  1. For newsletters/marketing:
  - Presence of unsubscribe links
  - Mass mailing indicators
  - Marketing language
  - Automated sending patterns
  
  2. For recruiting emails:
  - Personal outreach language
  - Job-related content
  - Company and position details
  
  Return in strict JSON format.`;
  
  try {
    const analysis = callOpenAI(prompt);
    return JSON.parse(analysis);
  } catch (error) {
    Logger.log('Error analyzing email: ' + error);
    return {
      emailType: "other",
      isRecruitingEmail: false,
      isFirstContact: false,
      isNewsletter: false,
      confidence: 0,
      recommendedAction: "ignore"
    };
  }
}

function generateResponse(analysis, from, subject, body) {
  const prompt = `Generate a professional response to this first-contact recruiting email:
  From: ${from}
  Subject: ${subject}
  Body: ${body}
  
  Job Details:
  - Title: ${analysis.jobTitle}
  - Company: ${analysis.companyName}
  - Platform: ${analysis.recruitingPlatform}
  
  Requirements:
  - Professional and enthusiastic tone
  - Acknowledge this is their first outreach
  - Reference 1-2 specific points from their message
  - If resume requested, mention you're attaching it
  - Keep it concise (100-150 words)
  - Include a clear next step
  
  Return response in plain text.
  Do not include subject of email in text.
  Take into consideration that:
  Date and times available to interview: any workday 8AM - 11 AM PST. I am green card holder.
  PROFILE:
            - Over 10 years of experience in software testing and development
            - Located in San Francisco, USA
            - Name: Aleksei Kuznetsov
            - Contact: aleksey.kuznetsof@gmail.com, +16283099031
            - Expert in test automation frameworks, programming languages, Agile methodologies
            - Strong focus on improving testing efficiency and software quality

            WORK EXPERIENCE:
            1. QA Engineer | SDET at Grip (Remote, Apr 2021 - Present):
            - Developed automation framework using Java, Playwright, Selenium (40% efficiency improvement)
            - Implemented CI/CD with Azure DevOps

            2. QA Engineer | SDET at Finstar Financial Group (Vietnam, Feb 2020 - Apr 2021):
            - Built automation frameworks for web/mobile testing (50% time reduction)
            - Mobile testing with Appium and C#

            3. QA Engineer | SDET at Raiffeisen Bank (Moscow, Mar 2019 - Feb 2020):
            - Developed test framework with Java, Cucumber, Selenide
            - Active participation in Scrum and requirement analysis

            4. QA Engineer, SDET at OJSC «MTT» (Moscow, Jan 2014 - Mar 2019):
            - Led marketing platform development (30% lead conversion improvement)
            - Implemented comprehensive testing strategies

            EDUCATION:
            - Master's Degree in Physics from MSU Lomonosov Moscow (2006-2012)
            - Master's Thesis on Neutrino Oscillations, OPERA Project contributor

            TECHNICAL SKILLS:
            - Test Automation: Selenium, Playwright, Appium, JUnit
            - Programming: Java, TypeScript, C#, Python
            - CI/CD: Jenkins, Bamboo, TeamCity
            - API Testing: Postman, RestAssured, SoapUI, GraphQL
            - Mobile: Appium (Android)
            - Performance: JMeter
            - BDD: Cucumber, SpecFlow
            - Cloud: AWS, Azure, GCP
            - Other: Docker, Kubernetes, Kafka, Rabbit MQ, SQL`;
  
  return {
    text: callOpenAI(prompt),
    shouldSendResume: analysis.shouldSendResume
  };
}

function callOpenAI(prompt) {
  const options = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + OPENAI_API_KEY,
      'Content-Type': 'application/json'
    },
    'payload': JSON.stringify({
      'model': 'gpt-3.5-turbo',  // Changed from gpt-4 to gpt-3.5-turbo
      'messages': [{
        'role': 'user',
        'content': prompt
      }],
      'temperature': 0.7,
      'max_tokens': 1000  // Added token limit for cost efficiency
    }),
    'muteHttpExceptions': true
  };

  try {
    const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      const errorText = response.getContentText();
      throw new Error(`API error (${responseCode}): ${errorText}`);
    }
    
    const responseText = JSON.parse(response.getContentText());
    return responseText.choices[0].message.content;
  } catch (error) {
    Logger.log('OpenAI API error: ' + error);
    throw error;
  }
}

function logInteraction(from, subject, analysis) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Recruiting Interactions') || 
    createInteractionsSheet();
    
  sheet.appendRow([
    new Date(),
    from,
    subject,
    analysis.jobTitle,
    analysis.companyName,
    analysis.confidence,
    analysis.recruitingPlatform
  ]);
}
function sendResponseWithResume(message, responseText) {
  const subject = `Re: ${message.getSubject()}`;
  const resume = DriveApp.getFileById(RESUME_DRIVE_ID);
  
  GmailApp.sendEmail(
    message.getFrom(),
    subject,
    responseText,
    {
      from: message.getTo(),
      threadId: message.getThread().getId(),
      attachments: [resume.getAs(MimeType.PDF)]
    }
  );
}

function processMessage(message) {
  const from = message.getFrom();
  const subject = message.getSubject();
  const body = message.getPlainBody();
  
  Logger.log(`Processing message: ${subject} from ${from}`);
  
  try {
    const emailAnalysis = analyzeEmail(from, subject, body);
    
    switch(emailAnalysis.recommendedAction) {
      case "respond":
        if (emailAnalysis.isRecruitingEmail && emailAnalysis.isFirstContact) {
          const response = generateResponse(emailAnalysis, from, subject, body);
          
          if (response.shouldSendResume) {
            sendResponseWithResume(message, response.text);
          } else {
            sendResponse(message, response.text);
          }
          message.markRead();
          logInteraction(from, subject, emailAnalysis);
        }
        break;
        
      case "mark_read":
        Logger.log('Newsletter or marketing email detected - marking as read');
        message.markRead();
        break;
        
      case "archive":
        Logger.log('Archivable content detected - marking as read and archiving');
        message.markRead();
        // Get the thread and remove INBOX label to archive
        const thread = message.getThread();
        thread.removeLabel(GmailApp.getUserLabelByName("INBOX"));
        break;
        
      case "ignore":
        Logger.log('Email requires manual review - leaving unread');
        break;
    }
    
    // Log the analysis
    logEmailAnalysis(from, subject, emailAnalysis);
    
  } catch (error) {
    Logger.log(`Error processing message: ${error.toString()}`);
  }
}

// Helper function to safely archive a thread
function archiveThread(thread) {
  try {
    // Remove INBOX label to archive the thread
    const inboxLabel = GmailApp.getUserLabelByName("INBOX");
    if (inboxLabel) {
      thread.removeLabel(inboxLabel);
      Logger.log('Successfully archived thread');
      return true;
    }
    return false;
  } catch (error) {
    Logger.log('Error archiving thread: ' + error.toString());
    return false;
  }
}

function logEmailAnalysis(from, subject, analysis) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Email Analysis Log') || 
    createAnalysisSheet();
    
  sheet.appendRow([
    new Date(),
    from,
    subject,
    analysis.emailType,
    analysis.confidence,
    analysis.recommendedAction,
    JSON.stringify(analysis.analysis)
  ]);
}

function createAnalysisSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .insertSheet('Email Analysis Log');
    
  sheet.appendRow([
    'Date',
    'From',
    'Subject',
    'Email Type',
    'Confidence Score',
    'Action Taken',
    'Detailed Analysis'
  ]);
  
  return sheet;
}




// Create menu
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Email Assistant with recruiters emails')
    .addItem('Process Unread Emails', 'processUnreadEmails')
    .addItem('Test With Recent Email', 'testWithRecentEmail')
    .addToUi();
}

// Set up time-based trigger to run every hour
function createTrigger() {
  ScriptApp.newTrigger('processUnreadEmails')
    .timeBased()
    .everyHours(1)
    .create();
}
