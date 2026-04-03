export type IntegrationTrigger = {
  id: string;
  label: string;
  description: string;
};

export type IntegrationAction = {
  id: string;
  label: string;
  description: string;
};

export type Integration = {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string;
  triggers: IntegrationTrigger[];
  actions: IntegrationAction[];
};

export const integrations: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "📧",
    color: "bg-red-500",
    category: "Communication",
    triggers: [
      { id: "gmail-t1", label: "New Email Received", description: "Fires when a new email arrives in your inbox" },
      { id: "gmail-t2", label: "New Email Matching Filter", description: "Fires when an email matches your filter criteria" },
    ],
    actions: [
      { id: "gmail-a1", label: "Send Email", description: "Send an email from your Gmail account" },
      { id: "gmail-a2", label: "Create Draft", description: "Create a new email draft" },
      { id: "gmail-a3", label: "Add Label", description: "Add a label to an email" },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    icon: "💬",
    color: "bg-purple-600",
    category: "Communication",
    triggers: [
      { id: "slack-t1", label: "New Message in Channel", description: "Fires when a new message is posted in a channel" },
      { id: "slack-t2", label: "New Direct Message", description: "Fires when you receive a direct message" },
      { id: "slack-t3", label: "New Mention", description: "Fires when you are mentioned in Slack" },
    ],
    actions: [
      { id: "slack-a1", label: "Send Channel Message", description: "Post a message to a Slack channel" },
      { id: "slack-a2", label: "Send DM", description: "Send a direct message to a user" },
      { id: "slack-a3", label: "Create Channel", description: "Create a new Slack channel" },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    icon: "🐙",
    color: "bg-gray-800",
    category: "Dev",
    triggers: [
      { id: "github-t1", label: "New Push", description: "Fires when code is pushed to a repository" },
      { id: "github-t2", label: "New PR Opened", description: "Fires when a pull request is opened" },
      { id: "github-t3", label: "New Issue", description: "Fires when a new issue is created" },
      { id: "github-t4", label: "PR Merged", description: "Fires when a pull request is merged" },
    ],
    actions: [
      { id: "github-a1", label: "Create Issue", description: "Create a new GitHub issue" },
      { id: "github-a2", label: "Comment on PR", description: "Add a comment to a pull request" },
      { id: "github-a3", label: "Star Repo", description: "Star a GitHub repository" },
    ],
  },
  {
    id: "spotify",
    name: "Spotify",
    icon: "🎵",
    color: "bg-green-500",
    category: "Media",
    triggers: [
      { id: "spotify-t1", label: "New Saved Track", description: "Fires when you save a new track" },
      { id: "spotify-t2", label: "Playlist Updated", description: "Fires when a playlist is updated" },
    ],
    actions: [
      { id: "spotify-a1", label: "Add Track to Playlist", description: "Add a track to a specified playlist" },
      { id: "spotify-a2", label: "Create Playlist", description: "Create a new Spotify playlist" },
      { id: "spotify-a3", label: "Follow Artist", description: "Follow an artist on Spotify" },
    ],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    icon: "📅",
    color: "bg-blue-500",
    category: "Productivity",
    triggers: [
      { id: "gcal-t1", label: "Event Starts", description: "Fires when a calendar event starts" },
      { id: "gcal-t2", label: "Event Created", description: "Fires when a new event is created" },
      { id: "gcal-t3", label: "Event Updated", description: "Fires when a calendar event is modified" },
    ],
    actions: [
      { id: "gcal-a1", label: "Create Event", description: "Create a new calendar event" },
      { id: "gcal-a2", label: "Update Event", description: "Update an existing calendar event" },
      { id: "gcal-a3", label: "Delete Event", description: "Delete a calendar event" },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    icon: "📝",
    color: "bg-gray-700",
    category: "Productivity",
    triggers: [
      { id: "notion-t1", label: "New Page Created", description: "Fires when a new page is created in Notion" },
      { id: "notion-t2", label: "Page Updated", description: "Fires when a Notion page is updated" },
      { id: "notion-t3", label: "Database Item Added", description: "Fires when a new item is added to a database" },
    ],
    actions: [
      { id: "notion-a1", label: "Create Page", description: "Create a new Notion page" },
      { id: "notion-a2", label: "Update Page", description: "Update an existing Notion page" },
      { id: "notion-a3", label: "Create Database Item", description: "Add a new item to a Notion database" },
    ],
  },
  {
    id: "twitter",
    name: "Twitter / X",
    icon: "🐦",
    color: "bg-sky-500",
    category: "Communication",
    triggers: [
      { id: "twitter-t1", label: "New Tweet by User", description: "Fires when a specific user posts a tweet" },
      { id: "twitter-t2", label: "New Mention", description: "Fires when someone mentions you" },
      { id: "twitter-t3", label: "New Follower", description: "Fires when you get a new follower" },
    ],
    actions: [
      { id: "twitter-a1", label: "Post Tweet", description: "Post a new tweet" },
      { id: "twitter-a2", label: "Like Tweet", description: "Like a specific tweet" },
      { id: "twitter-a3", label: "Follow User", description: "Follow a Twitter user" },
    ],
  },
  {
    id: "discord",
    name: "Discord",
    icon: "🎮",
    color: "bg-indigo-600",
    category: "Communication",
    triggers: [
      { id: "discord-t1", label: "New Message in Channel", description: "Fires on new messages in a Discord channel" },
      { id: "discord-t2", label: "New Member Joins", description: "Fires when a new member joins a server" },
      { id: "discord-t3", label: "New Role Assigned", description: "Fires when a role is assigned to a user" },
    ],
    actions: [
      { id: "discord-a1", label: "Send Message", description: "Send a message to a Discord channel" },
      { id: "discord-a2", label: "Create Channel", description: "Create a new Discord channel" },
      { id: "discord-a3", label: "Assign Role", description: "Assign a role to a server member" },
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    icon: "🛍️",
    color: "bg-green-600",
    category: "Finance",
    triggers: [
      { id: "shopify-t1", label: "New Order", description: "Fires when a new order is placed" },
      { id: "shopify-t2", label: "Order Fulfilled", description: "Fires when an order is fulfilled" },
      { id: "shopify-t3", label: "New Customer", description: "Fires when a new customer signs up" },
      { id: "shopify-t4", label: "Inventory Low", description: "Fires when product inventory falls below threshold" },
    ],
    actions: [
      { id: "shopify-a1", label: "Create Product", description: "Add a new product to your Shopify store" },
      { id: "shopify-a2", label: "Update Inventory", description: "Update product inventory levels" },
      { id: "shopify-a3", label: "Send Notification", description: "Send a notification to a customer" },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    icon: "💳",
    color: "bg-violet-600",
    category: "Finance",
    triggers: [
      { id: "stripe-t1", label: "New Payment", description: "Fires when a successful payment is made" },
      { id: "stripe-t2", label: "Payment Failed", description: "Fires when a payment attempt fails" },
      { id: "stripe-t3", label: "New Subscription", description: "Fires when a new subscription is created" },
      { id: "stripe-t4", label: "Subscription Cancelled", description: "Fires when a subscription is cancelled" },
    ],
    actions: [
      { id: "stripe-a1", label: "Create Invoice", description: "Create a new Stripe invoice" },
      { id: "stripe-a2", label: "Refund Payment", description: "Refund a payment" },
      { id: "stripe-a3", label: "Create Coupon", description: "Create a new discount coupon" },
    ],
  },
  {
    id: "airtable",
    name: "Airtable",
    icon: "📊",
    color: "bg-yellow-500",
    category: "Productivity",
    triggers: [
      { id: "airtable-t1", label: "New Record", description: "Fires when a new record is created" },
      { id: "airtable-t2", label: "Record Updated", description: "Fires when a record is updated" },
      { id: "airtable-t3", label: "Record Deleted", description: "Fires when a record is deleted" },
    ],
    actions: [
      { id: "airtable-a1", label: "Create Record", description: "Create a new Airtable record" },
      { id: "airtable-a2", label: "Update Record", description: "Update an existing record" },
      { id: "airtable-a3", label: "Delete Record", description: "Delete a record from a table" },
    ],
  },
  {
    id: "trello",
    name: "Trello",
    icon: "📋",
    color: "bg-blue-600",
    category: "Productivity",
    triggers: [
      { id: "trello-t1", label: "New Card", description: "Fires when a new card is created" },
      { id: "trello-t2", label: "Card Moved", description: "Fires when a card is moved to another list" },
      { id: "trello-t3", label: "Card Due Soon", description: "Fires when a card is due within 24 hours" },
    ],
    actions: [
      { id: "trello-a1", label: "Create Card", description: "Create a new Trello card" },
      { id: "trello-a2", label: "Move Card", description: "Move a card to a different list" },
      { id: "trello-a3", label: "Add Comment", description: "Add a comment to a card" },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    icon: "📱",
    color: "bg-red-600",
    category: "Communication",
    triggers: [
      { id: "twilio-t1", label: "SMS Received", description: "Fires when an SMS message is received" },
      { id: "twilio-t2", label: "Call Received", description: "Fires when an inbound call is received" },
    ],
    actions: [
      { id: "twilio-a1", label: "Send SMS", description: "Send an SMS message" },
      { id: "twilio-a2", label: "Make Call", description: "Initiate a phone call" },
      { id: "twilio-a3", label: "Send WhatsApp", description: "Send a WhatsApp message" },
    ],
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    icon: "🐒",
    color: "bg-yellow-400",
    category: "Communication",
    triggers: [
      { id: "mailchimp-t1", label: "New Subscriber", description: "Fires when someone subscribes to your list" },
      { id: "mailchimp-t2", label: "Email Opened", description: "Fires when a subscriber opens an email" },
      { id: "mailchimp-t3", label: "Link Clicked", description: "Fires when a subscriber clicks a link" },
    ],
    actions: [
      { id: "mailchimp-a1", label: "Add Subscriber", description: "Add a new subscriber to your list" },
      { id: "mailchimp-a2", label: "Send Campaign", description: "Send an email campaign" },
      { id: "mailchimp-a3", label: "Add Tag", description: "Add a tag to a subscriber" },
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "▶️",
    color: "bg-red-600",
    category: "Media",
    triggers: [
      { id: "youtube-t1", label: "New Video Uploaded", description: "Fires when a new video is uploaded to a channel" },
      { id: "youtube-t2", label: "New Comment", description: "Fires when a new comment is posted" },
      { id: "youtube-t3", label: "Channel Subscriber", description: "Fires when someone subscribes to a channel" },
    ],
    actions: [
      { id: "youtube-a1", label: "Upload Video", description: "Upload a video to YouTube" },
      { id: "youtube-a2", label: "Post Comment", description: "Post a comment on a video" },
      { id: "youtube-a3", label: "Add to Playlist", description: "Add a video to a playlist" },
    ],
  },
  {
    id: "rss",
    name: "RSS Feed",
    icon: "📡",
    color: "bg-orange-500",
    category: "Media",
    triggers: [
      { id: "rss-t1", label: "New Feed Item", description: "Fires when a new item is published in an RSS feed" },
    ],
    actions: [
      { id: "rss-a1", label: "Fetch Feed Items", description: "Retrieve the latest items from an RSS feed" },
    ],
  },
  {
    id: "webhook",
    name: "Webhook",
    icon: "🔗",
    color: "bg-gray-500",
    category: "Dev",
    triggers: [
      { id: "webhook-t1", label: "Webhook Received", description: "Fires when a webhook payload is received" },
    ],
    actions: [
      { id: "webhook-a1", label: "Send Webhook", description: "Send a webhook to a URL" },
      { id: "webhook-a2", label: "POST Request", description: "Make an HTTP POST request" },
      { id: "webhook-a3", label: "GET Request", description: "Make an HTTP GET request" },
    ],
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    icon: "📈",
    color: "bg-green-500",
    category: "Productivity",
    triggers: [
      { id: "gsheets-t1", label: "New Row Added", description: "Fires when a new row is added to a sheet" },
      { id: "gsheets-t2", label: "Row Updated", description: "Fires when a row is updated" },
      { id: "gsheets-t3", label: "Sheet Updated", description: "Fires when any changes are made to a sheet" },
    ],
    actions: [
      { id: "gsheets-a1", label: "Add Row", description: "Add a new row to a spreadsheet" },
      { id: "gsheets-a2", label: "Update Row", description: "Update an existing row" },
      { id: "gsheets-a3", label: "Create Sheet", description: "Create a new sheet in a spreadsheet" },
    ],
  },
  {
    id: "dropbox",
    name: "Dropbox",
    icon: "📦",
    color: "bg-blue-500",
    category: "Productivity",
    triggers: [
      { id: "dropbox-t1", label: "New File", description: "Fires when a new file is added to a folder" },
      { id: "dropbox-t2", label: "File Modified", description: "Fires when a file is modified" },
      { id: "dropbox-t3", label: "File Deleted", description: "Fires when a file is deleted" },
    ],
    actions: [
      { id: "dropbox-a1", label: "Upload File", description: "Upload a file to Dropbox" },
      { id: "dropbox-a2", label: "Move File", description: "Move a file to a different folder" },
      { id: "dropbox-a3", label: "Share File", description: "Create a shared link for a file" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "🤖",
    color: "bg-teal-600",
    category: "Dev",
    triggers: [
      { id: "openai-t1", label: "Completion Ready", description: "Fires when an AI completion is available" },
    ],
    actions: [
      { id: "openai-a1", label: "Generate Text", description: "Generate text using GPT models" },
      { id: "openai-a2", label: "Create Image", description: "Generate an image using DALL-E" },
      { id: "openai-a3", label: "Analyze Image", description: "Analyze an image using GPT-4 Vision" },
    ],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    icon: "🧡",
    color: "bg-orange-500",
    category: "Finance",
    triggers: [
      { id: "hubspot-t1", label: "New Contact", description: "Fires when a new contact is created" },
      { id: "hubspot-t2", label: "Deal Stage Changed", description: "Fires when a deal moves to a new stage" },
      { id: "hubspot-t3", label: "Form Submitted", description: "Fires when a HubSpot form is submitted" },
    ],
    actions: [
      { id: "hubspot-a1", label: "Create Contact", description: "Create a new contact in HubSpot" },
      { id: "hubspot-a2", label: "Create Deal", description: "Create a new deal in the CRM" },
      { id: "hubspot-a3", label: "Send Email", description: "Send a marketing email via HubSpot" },
    ],
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "✈️",
    color: "bg-sky-400",
    category: "Communication",
    triggers: [
      { id: "telegram-t1", label: "New Message", description: "Fires when a new message is received" },
      { id: "telegram-t2", label: "New Channel Post", description: "Fires when a post is made in a channel" },
    ],
    actions: [
      { id: "telegram-a1", label: "Send Message", description: "Send a message via Telegram bot" },
      { id: "telegram-a2", label: "Send Photo", description: "Send a photo via Telegram bot" },
      { id: "telegram-a3", label: "Send Document", description: "Send a document via Telegram bot" },
    ],
  },
];

export const categories = ["All", "Communication", "Productivity", "Finance", "Dev", "Media"];
