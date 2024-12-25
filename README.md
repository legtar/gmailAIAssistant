# AI Email Assistant Setup Guide

## Prerequisites
1. Gmail account
2. OpenAI API key (get it from platform.openai.com)
3. Your resume in PDF format uploaded to Google Drive

## Step-by-Step Setup

### 1. Create a New Google Apps Script
1. Go to script.google.com
2. Click "New Project"
3. Delete any default code in the editor

### 2. Set Up Configuration
At the top of your script, add these constants:
```javascript
// Configuration
const OPENAI_API_KEY = 'your-api-key-here'; // Replace with your OpenAI API key
const RESUME_DRIVE_ID = 'your-file-id-here'; // Replace with your resume's Google Drive file ID
const MAX_EMAIL_AGE_DAYS = 2;
```

### 3. Upload Your Code
1. Create separate files for each main function (click + next to Files):
   - emailAnalyzer.gs
   - messageProcessor.gs
   - openaiHandler.gs
2. Copy and paste the respective code into each file
3. Save all files

### 4. Setup Triggers
1. Click on "Triggers" (clock icon) in the left sidebar
2. Click "+ Add Trigger"
3. Configure the trigger:
   - Choose function: processUnreadInboxEmails
   - Event source: Time-driven
   - Type: Minutes timer
   - Interval: Every 30 minutes

### 5. Test Your Setup
1. Run the testEmailAnalysis function
2. Check the execution logs
3. Send yourself a test email and watch it being processed

### 6. Customize Your Settings

#### Response Templates
Edit the emailTemplate in generateResponse function:
```javascript
const emailTemplate = `
<html>
  <body style="font-family: Arial, sans-serif;">
    <p>Dear {name},</p>
    <p>Thank you for reaching out about the {position} role at {company}.</p>
    <!-- Add your custom template here -->
    <p>Best regards,<br>[Your name]</p>
  </body>
</html>`;
```

#### Email Analysis Settings
Adjust the analysis criteria in analyzeEmail function:
```javascript
const prompt = `Analyze this email and determine...
  // Customize your analysis criteria here
`;
```

## Troubleshooting

### Common Issues:

1. Authorization Error
   - Solution: Click "Review Permissions" and grant necessary access

2. Rate Limit Error
   - Solution: Adjust RATE_LIMIT settings in openaiHandler.gs

3. Email Not Being Processed
   - Check if email is in Inbox
   - Verify it's unread
   - Check execution logs

### Best Practices

1. Email Processing
   - Keep emails in inbox until processed
   - Don't modify running scripts
   - Check logs regularly

2. API Usage
   - Monitor your OpenAI API usage
   - Adjust rate limits if needed
   - Keep your API key secure

3. Maintenance
   - Review logs weekly
   - Update templates monthly
   - Test with new email formats

## Safety Features

1. Email Protection
   - Only processes unread inbox emails
   - Ignores spam
   - Age limit on processed emails

2. API Safety
   - Rate limiting
   - Error handling
   - Retry logic

3. Content Safety
   - Content truncation
   - Error logging
   - Backup responses

## Optional Enhancements

1. Add Custom Labels
```javascript
// Create a label for processed emails
const label = GmailApp.createLabel('AI Processed');
message.addLabel(label);
```

2. Add Email Statistics
```javascript
// Track processing statistics
const stats = PropertiesService.getScriptProperties();
stats.setProperty('processed_count', 
  (parseInt(stats.getProperty('processed_count') || 0) + 1).toString());
```

3. Add Custom Filters
```javascript
// Add company-specific handling
if (emailAnalysis.companyName === 'DesiredCompany') {
  // Special handling
}
```

## Security Considerations

1. API Key Protection
   - Store in Script Properties
   - Never share your script publicly with the key

2. Email Access
   - Review permissions regularly
   - Use minimal necessary scope

3. Data Protection
   - Don't store sensitive data
   - Clear logs regularly
   - Monitor access

## Support

For issues or questions:
1. Check execution logs
2. Review error messages
3. Test with sample emails
4. Adjust settings as needed

Remember to backup your script before making changes!
