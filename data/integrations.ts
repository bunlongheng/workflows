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
  // --- Top 8: User's personal apps ---
  {
    id: "youtube",
    name: "YouTube",
    icon: "/icons/youtube.svg",
    color: "bg-red-600",
    category: "Media",
    triggers: [
      { id: "youtube-t1", label: "New Video Uploaded", description: "Fires when a new video is uploaded to a channel" },
      { id: "youtube-t2", label: "Video Liked", description: "Fires when you like a video on YouTube" },
      { id: "youtube-t3", label: "New Video in Playlist", description: "Fires when a video is added to a watched playlist" },
      { id: "youtube-t4", label: "New Comment on Video", description: "Fires when a new comment is posted on your video" },
    ],
    actions: [
      { id: "youtube-a1", label: "Get Transcript", description: "Fetch the full transcript/captions of a video" },
      { id: "youtube-a2", label: "Upload Video", description: "Upload a video to YouTube" },
      { id: "youtube-a3", label: "Add to Playlist", description: "Add a video to a playlist" },
    ],
  },
  {
    id: "stickies",
    name: "Stickies",
    icon: "/icons/stickies.svg",
    color: "bg-yellow-500",
    category: "Productivity",
    triggers: [
      { id: "stickies-t1", label: "New Sticky Created", description: "Fires when a new sticky note is created" },
    ],
    actions: [
      { id: "stickies-a1", label: "Create Sticky", description: "Post a new sticky note" },
      { id: "stickies-a2", label: "Update Sticky", description: "Update an existing sticky note" },
    ],
  },
  {
    id: "gmail",
    name: "Gmail",
    icon: "/icons/gmail.svg",
    color: "bg-blue-500",
    category: "Communication",
    triggers: [
      { id: "gmail-t1", label: "New Email Received", description: "Fires when a new email arrives in your inbox" },
      { id: "gmail-t2", label: "Subject Match", description: "Fires when email subject contains a keyword" },
      { id: "gmail-t3", label: "From Match", description: "Fires when email is from a specific sender" },
      { id: "gmail-t4", label: "Body Match", description: "Fires when email body contains a keyword" },
      { id: "gmail-t5", label: "Search Query Match", description: "Fires when Gmail search query finds new results" },
    ],
    actions: [
      { id: "gmail-a1", label: "Send Email", description: "Send an email via Gmail" },
      { id: "gmail-a2", label: "Archive Email", description: "Archive the matched email" },
      { id: "gmail-a3", label: "Label Email", description: "Apply a label to the matched email" },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    icon: "/icons/github.svg",
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
      { id: "github-a3", label: "Create PR", description: "Open a pull request on a repository" },
    ],
  },
  {
    id: "diagram",
    name: "Diagram",
    icon: "/icons/diagram.svg",
    color: "bg-indigo-500",
    category: "Productivity",
    triggers: [
      { id: "diagram-t1", label: "Diagram Generated", description: "Fires when a new diagram is generated" },
    ],
    actions: [
      { id: "diagram-a1", label: "Create Diagram", description: "Generate a diagram from structured data" },
    ],
  },
  {
    id: "hue",
    name: "Philips Hue",
    icon: "/icons/hue.svg",
    color: "bg-green-600",
    category: "Smart Home",
    triggers: [
      { id: "hue-t1", label: "Motion Detected", description: "Fires when a Hue motion sensor detects movement" },
      { id: "hue-t2", label: "Button Pressed", description: "Fires when a Hue smart button is pressed" },
    ],
    actions: [
      { id: "hue-a1", label: "Flash Lights", description: "Flash lights in a room or group" },
      { id: "hue-a2", label: "Set Scene", description: "Set a Hue scene in a room" },
      { id: "hue-a3", label: "Toggle Lights", description: "Turn lights on or off" },
      { id: "hue-a4", label: "Set Color", description: "Change light color in a group" },
    ],
  },
  {
    id: "mindmap",
    name: "Mind Map",
    icon: "/icons/mindmap.svg",
    color: "bg-purple-500",
    category: "Productivity",
    triggers: [
      { id: "mindmap-t1", label: "Mind Map Generated", description: "Fires when a mind map is generated" },
    ],
    actions: [
      { id: "mindmap-a1", label: "Create Mind Map", description: "Generate a mind map from content" },
    ],
  },
  {
    id: "claude",
    name: "Claude",
    icon: "/icons/claude.svg",
    color: "bg-orange-500",
    category: "AI",
    triggers: [
      { id: "claude-t1", label: "Response Complete", description: "Fires when Claude finishes generating a response" },
    ],
    actions: [
      { id: "claude-a1", label: "Summarize", description: "Summarize content using Claude" },
      { id: "claude-a2", label: "Analyze", description: "Analyze and extract insights from content" },
      { id: "claude-a3", label: "Generate", description: "Generate content from a prompt" },
      { id: "claude-a4", label: "Classify", description: "Classify or categorize input content" },
    ],
  },
  {
    id: "openclaw",
    name: "Open Claw",
    icon: "/icons/openclaw.svg",
    color: "bg-red-600",
    category: "AI",
    triggers: [
      { id: "openclaw-t1", label: "Bot Message Received", description: "Fires when your Telegram bot receives a message" },
    ],
    actions: [
      { id: "openclaw-a1", label: "Send Bot Message", description: "Send a message via your Telegram bot" },
      { id: "openclaw-a2", label: "Run Agent", description: "Execute an Open Claw autonomous agent" },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    icon: "/icons/slack.svg",
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
    ],
  },
  {
    id: "google-calendar",
    name: "Calendar",
    icon: "/icons/google-calendar.svg",
    color: "bg-blue-500",
    category: "Productivity",
    triggers: [
      { id: "gcal-t1", label: "Event Starts", description: "Fires when a calendar event starts" },
      { id: "gcal-t2", label: "Event Created", description: "Fires when a new event is created" },
    ],
    actions: [
      { id: "gcal-a1", label: "Create Event", description: "Create a new calendar event" },
    ],
  },
  {
    id: "webhook",
    name: "Webhook",
    icon: "🔗",
    color: "bg-teal-500",
    category: "Dev",
    triggers: [
      { id: "webhook-t1", label: "Webhook Received", description: "Fires when a webhook payload is received" },
    ],
    actions: [
      { id: "webhook-a1", label: "Send Webhook", description: "Send a webhook to a URL" },
      { id: "webhook-a2", label: "POST Request", description: "Make an HTTP POST request" },
    ],
  },
];

export const categories = ["All", "My Apps", "AI", "Communication", "Productivity", "Dev", "Media"];
