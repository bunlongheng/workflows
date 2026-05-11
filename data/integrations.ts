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
      { id: "stickies-a3", label: "Search Stickies", description: "Search sticky notes by keyword" },
    ],
  },
  {
    id: "gmail",
    name: "Gmail",
    icon: "/icons/gmail.svg",
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
      { id: "github-a3", label: "Star Repo", description: "Star a GitHub repository" },
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
      { id: "diagram-a2", label: "Export Diagram", description: "Export diagram as PNG or SVG" },
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
      { id: "mindmap-a2", label: "Expand Branch", description: "Add sub-topics to a mind map branch" },
    ],
  },
  {
    id: "local-apps",
    name: "Local Apps",
    icon: "/icons/local-apps.svg",
    color: "bg-cyan-600",
    category: "Dev",
    triggers: [
      { id: "local-t1", label: "App Started", description: "Fires when a local app starts running" },
      { id: "local-t2", label: "App Crashed", description: "Fires when a local app crashes or stops" },
      { id: "local-t3", label: "Health Check Failed", description: "Fires when a health check returns non-200" },
    ],
    actions: [
      { id: "local-a1", label: "Start App", description: "Start a local application" },
      { id: "local-a2", label: "Restart App", description: "Restart a running application" },
      { id: "local-a3", label: "Check Status", description: "Check health status of all local apps" },
    ],
  },
  {
    id: "claude-dashboard",
    name: "Claude",
    icon: "/icons/claude-dashboard.svg",
    color: "bg-amber-600",
    category: "Dev",
    triggers: [
      { id: "claude-t1", label: "Session Complete", description: "Fires when a Claude Code session completes" },
      { id: "claude-t2", label: "New Conversation", description: "Fires when a new conversation starts" },
    ],
    actions: [
      { id: "claude-a1", label: "Log Session", description: "Log session details to the dashboard" },
      { id: "claude-a2", label: "Query History", description: "Search past conversation history" },
    ],
  },
  // --- Supporting integrations ---
  {
    id: "ai-processing",
    name: "AI Processing",
    icon: "/icons/ai-processing.svg",
    color: "bg-emerald-600",
    category: "Productivity",
    triggers: [
      { id: "ai-t1", label: "Processing Complete", description: "Fires when AI finishes processing content" },
    ],
    actions: [
      { id: "ai-a1", label: "Summarize Content", description: "Generate a concise summary from text or transcript" },
      { id: "ai-a2", label: "Extract Top Ideas", description: "Pull out key insights and takeaways from content" },
      { id: "ai-a3", label: "Generate Mind Map", description: "Create a structured mind map from content" },
      { id: "ai-a4", label: "Create Presentation", description: "Turn content into slide deck outline" },
      { id: "ai-a5", label: "Generate Notes", description: "Create structured study/reference notes" },
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
      { id: "slack-a3", label: "Create Channel", description: "Create a new Slack channel" },
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
      { id: "gcal-a2", label: "Update Event", description: "Update an existing calendar event" },
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
    ],
  },
];

export const categories = ["All", "My Apps", "Communication", "Productivity", "Dev", "Media"];
