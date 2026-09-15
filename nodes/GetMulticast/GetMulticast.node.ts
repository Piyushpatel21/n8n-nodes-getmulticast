import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestOptions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import { NodeConnectionTypes } from "n8n-workflow";

const BASE_URL = "https://getmulticast.com/api/v1";

// Every resource/operation below maps 1:1 to one documented endpoint at
// https://getmulticast.com/api-docs.html — this node makes no decisions
// of its own, it only shapes n8n's inputs into the real API call.
export class GetMulticast implements INodeType {
  description: INodeTypeDescription = {
    displayName: "GetMulticast",
    name: "getMulticast",
    icon: "file:getmulticast.svg",
    group: ["output"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: "Generate AI videos, publish posts, manage replies, and configure webhooks/RSS feeds via the GetMulticast API",
    defaults: { name: "GetMulticast" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: "getMulticastApi", required: true }],
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "Account", value: "account" },
          { name: "Comment", value: "comment" },
          { name: "Credits", value: "credits" },
          { name: "Pending Reply", value: "pendingReply" },
          { name: "Post", value: "post" },
          { name: "Recycling Rule", value: "recyclingRule" },
          { name: "RSS Feed", value: "rssFeed" },
          { name: "Video", value: "video" },
          { name: "Webhook", value: "webhook" },
        ],
        default: "post",
      },

      // ── Post ──────────────────────────────────────────────────────
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["post"] } },
        options: [
          { name: "Create (Publish Now)", value: "create", action: "Publish a post now" },
          { name: "Get", value: "get", action: "Get one post" },
          { name: "List", value: "list", action: "List posts" },
          { name: "Retry", value: "retry", action: "Retry a failed platform" },
          { name: "Schedule", value: "schedule", action: "Schedule a post for later" },
          { name: "List Scheduled", value: "listScheduled", action: "List scheduled posts" },
          { name: "Reschedule", value: "reschedule", action: "Reschedule a pending post" },
          { name: "Delete Scheduled", value: "deleteScheduled", action: "Delete a scheduled post" },
          { name: "Get Analytics", value: "analytics", action: "Get real per-post metrics for one platform" },
        ],
        default: "create",
      },
      {
        displayName: "Media URL",
        name: "mediaUrl",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["post"], operation: ["create", "schedule"] } },
        description: "Public URL to the video or image file",
      },
      {
        displayName: "Media Type",
        name: "mediaType",
        type: "options",
        options: [{ name: "Image", value: "image" }, { name: "Video", value: "video" }],
        default: "image",
        displayOptions: { show: { resource: ["post"], operation: ["create", "schedule"] } },
      },
      {
        displayName: "Selections (JSON)",
        name: "selections",
        type: "json",
        default: '{\n  "instagram": ["accountId"]\n}',
        required: true,
        displayOptions: { show: { resource: ["post"], operation: ["create", "schedule"] } },
        description: "Platform -> array of account ids. Get account ids from the Account > List operation.",
      },
      {
        displayName: "Caption",
        name: "caption",
        type: "string",
        default: "",
        displayOptions: { show: { resource: ["post"], operation: ["create", "schedule"] } },
      },
      {
        displayName: "Hashtags (comma-separated)",
        name: "hashtags",
        type: "string",
        default: "",
        displayOptions: { show: { resource: ["post"], operation: ["create", "schedule"] } },
      },
      {
        displayName: "Date",
        name: "date",
        type: "string",
        default: "",
        required: true,
        placeholder: "YYYY-MM-DD",
        displayOptions: { show: { resource: ["post"], operation: ["schedule"] } },
      },
      {
        displayName: "Time",
        name: "time",
        type: "string",
        default: "09:00",
        placeholder: "HH:MM",
        displayOptions: { show: { resource: ["post"], operation: ["schedule"] } },
      },
      {
        displayName: "Timezone",
        name: "timezone",
        type: "string",
        default: "UTC",
        description: "IANA timezone name, e.g. America/New_York",
        displayOptions: { show: { resource: ["post"], operation: ["schedule"] } },
      },
      {
        displayName: "Post ID",
        name: "postId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["post"], operation: ["get", "retry", "reschedule", "deleteScheduled", "analytics"] } },
      },
      {
        displayName: "Platform",
        name: "analyticsPlatform",
        type: "options",
        options: [
          { name: "YouTube", value: "youtube" },
          { name: "X", value: "x" },
          { name: "Pinterest", value: "pinterest" },
          { name: "Bluesky", value: "bluesky" },
        ],
        default: "youtube",
        required: true,
        displayOptions: { show: { resource: ["post"], operation: ["analytics"] } },
        description: "Real per-post metrics are only wired for these 4 platforms — any other platform returns a real not_supported error naming the missing permission",
      },
      {
        displayName: "Platform",
        name: "platform",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["post"], operation: ["retry"] } },
        description: "Which platform's failed accounts to retry, e.g. instagram",
      },
      {
        displayName: "Scheduled At (UTC, ISO)",
        name: "scheduledAtUtc",
        type: "string",
        default: "",
        placeholder: "2026-09-21T14:00:00Z",
        displayOptions: { show: { resource: ["post"], operation: ["reschedule"] } },
      },
      {
        displayName: "Limit",
        name: "limit",
        type: "number",
        default: 25,
        displayOptions: { show: { resource: ["post"], operation: ["list", "listScheduled"] } },
      },

      // ── Comment ───────────────────────────────────────────────────
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["comment"] } },
        options: [
          { name: "List", value: "list", action: "List recent comments" },
          { name: "Reply", value: "reply", action: "Reply to a comment" },
          { name: "Dismiss", value: "dismiss", action: "Dismiss a comment without replying" },
        ],
        default: "list",
      },
      {
        displayName: "Platform",
        name: "platform",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["comment"], operation: ["reply", "dismiss"] } },
      },
      {
        displayName: "Account ID",
        name: "accountId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["comment"], operation: ["reply", "dismiss"] } },
      },
      {
        displayName: "Comment ID",
        name: "commentId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["comment"], operation: ["reply", "dismiss"] } },
      },
      {
        displayName: "Original Comment Text",
        name: "text",
        type: "string",
        default: "",
        displayOptions: { show: { resource: ["comment"], operation: ["reply"] } },
        description: "Used for the AI draft if Direct Text is left empty",
      },
      {
        displayName: "Direct Text",
        name: "directText",
        type: "string",
        default: "",
        displayOptions: { show: { resource: ["comment"], operation: ["reply"] } },
        description: "Send exactly this text immediately, no AI involved. Leave empty to have AI draft a reply into the review queue instead.",
      },

      // ── Pending Reply ─────────────────────────────────────────────
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["pendingReply"] } },
        options: [
          { name: "List", value: "list", action: "List the review queue" },
          { name: "Approve", value: "approve", action: "Send a pending reply" },
          { name: "Reject", value: "reject", action: "Discard a pending reply" },
          { name: "Regenerate", value: "regenerate", action: "Ask AI to revise the draft" },
          { name: "Update Text", value: "updateText", action: "Overwrite the draft text" },
        ],
        default: "list",
      },
      {
        displayName: "Pending Reply ID",
        name: "pendingId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["pendingReply"], operation: ["approve", "reject", "regenerate", "updateText"] } },
      },
      {
        displayName: "Edited Text",
        name: "editedText",
        type: "string",
        default: "",
        displayOptions: { show: { resource: ["pendingReply"], operation: ["approve"] } },
        description: "Leave empty to send the AI draft as-is",
      },
      {
        displayName: "Instruction",
        name: "context",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["pendingReply"], operation: ["regenerate"] } },
        description: "e.g. make it shorter and friendlier",
      },
      {
        displayName: "Text",
        name: "text",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["pendingReply"], operation: ["updateText"] } },
      },

      // ── Webhook ───────────────────────────────────────────────────
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["webhook"] } },
        options: [
          { name: "Register", value: "register", action: "Register a webhook" },
          { name: "List", value: "list", action: "List webhooks" },
          { name: "Delete", value: "delete", action: "Delete a webhook" },
          { name: "List Deliveries", value: "listDeliveries", action: "List delivery history" },
        ],
        default: "register",
      },
      {
        displayName: "URL",
        name: "url",
        type: "string",
        default: "",
        required: true,
        description: "In n8n, this is usually a Webhook node's Production URL",
        displayOptions: { show: { resource: ["webhook"], operation: ["register"] } },
      },
      {
        displayName: "Events",
        name: "events",
        type: "multiOptions",
        options: [
          { name: "post.published", value: "post.published" },
          { name: "post.failed", value: "post.failed" },
          { name: "comment.received", value: "comment.received" },
          { name: "reply.sent", value: "reply.sent" },
        ],
        default: [],
        required: true,
        displayOptions: { show: { resource: ["webhook"], operation: ["register"] } },
      },
      {
        displayName: "Webhook ID",
        name: "webhookId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["webhook"], operation: ["delete", "listDeliveries"] } },
      },

      // ── RSS Feed ──────────────────────────────────────────────────
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["rssFeed"] } },
        options: [
          { name: "Create", value: "create", action: "Register a feed" },
          { name: "List", value: "list", action: "List feeds" },
          { name: "Update", value: "update", action: "Update a feed" },
          { name: "Delete", value: "delete", action: "Delete a feed" },
          { name: "Check Now", value: "checkNow", action: "Check a feed immediately" },
        ],
        default: "create",
      },
      {
        displayName: "Feed URL",
        name: "url",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["rssFeed"], operation: ["create"] } },
      },
      {
        displayName: "Selections (JSON)",
        name: "selections",
        type: "json",
        default: '{\n  "instagram": ["accountId"]\n}',
        displayOptions: { show: { resource: ["rssFeed"], operation: ["create", "update"] } },
        description: "Only facebook, instagram, threads, pinterest, and bluesky support image posts today",
      },
      {
        displayName: "Caption Template",
        name: "captionTemplate",
        type: "string",
        default: "{title}\n\n{link}",
        displayOptions: { show: { resource: ["rssFeed"], operation: ["create", "update"] } },
      },
      {
        displayName: "Check Interval (Minutes)",
        name: "checkIntervalMinutes",
        type: "number",
        default: 60,
        description: "Minimum 15",
        displayOptions: { show: { resource: ["rssFeed"], operation: ["create", "update"] } },
      },
      {
        displayName: "Feed ID",
        name: "feedId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["rssFeed"], operation: ["update", "delete", "checkNow"] } },
      },
      {
        displayName: "Active",
        name: "active",
        type: "boolean",
        default: true,
        displayOptions: { show: { resource: ["rssFeed"], operation: ["update"] } },
      },

      // ── Recycling Rule ───────────────────────────────────────────
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["recyclingRule"] } },
        options: [
          { name: "Create", value: "create", action: "Create a recycling rule" },
          { name: "List", value: "list", action: "List recycling rules" },
          { name: "Update", value: "update", action: "Update a recycling rule" },
          { name: "Delete", value: "delete", action: "Delete a recycling rule" },
          { name: "Run Now", value: "runNow", action: "Recycle immediately" },
        ],
        default: "create",
      },
      {
        displayName: "Source Post ID",
        name: "sourcePostId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["recyclingRule"], operation: ["create"] } },
        description: "A post id (from Post > List) that already published successfully",
      },
      {
        displayName: "Selections (JSON)",
        name: "selections",
        type: "json",
        default: "",
        displayOptions: { show: { resource: ["recyclingRule"], operation: ["create", "update"] } },
        description: "Leave empty on create to default to the accounts the source post actually succeeded on",
      },
      {
        displayName: "Interval (Days)",
        name: "intervalDays",
        type: "number",
        default: 30,
        displayOptions: { show: { resource: ["recyclingRule"], operation: ["create", "update"] } },
      },
      {
        displayName: "Rewrite Caption with AI",
        name: "rewriteCaption",
        type: "boolean",
        default: false,
        displayOptions: { show: { resource: ["recyclingRule"], operation: ["create", "update"] } },
        description: "If true, AI rewrites the caption each time so it doesn't read as an exact repeat",
      },
      {
        displayName: "Rule ID",
        name: "ruleId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["recyclingRule"], operation: ["update", "delete", "runNow"] } },
      },
      {
        displayName: "Active",
        name: "active",
        type: "boolean",
        default: true,
        displayOptions: { show: { resource: ["recyclingRule"], operation: ["update"] } },
      },

      // ── Video ─────────────────────────────────────────────────────
      // Mirrors Blotato's Visual resource (Create/Get) — generate an AI
      // video, poll Get until status is "ready", then feed the
      // resulting videoUrl straight into Post > Create/Schedule. Same
      // engine as the dashboard's own Generate Video button. Best-effort:
      // the underlying free provider (Agnes) can occasionally fail or
      // queue up — this is a bonus capability, not GetMulticast's core
      // scheduling/publishing function.
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["video"] } },
        options: [
          { name: "Create", value: "create", action: "Generate a new AI video" },
          { name: "Get", value: "get", action: "Check a video's generation status" },
          { name: "List", value: "list", action: "List videos" },
          { name: "Delete", value: "delete", action: "Delete a video" },
        ],
        default: "create",
      },
      {
        displayName: "Prompt",
        name: "videoPrompt",
        type: "string",
        default: "",
        displayOptions: { show: { resource: ["video"], operation: ["create"] } },
        description: "What the video should be about — becomes a single implicit scene when Scenes (JSON) is left empty",
      },
      {
        displayName: "Aspect Ratio",
        name: "aspectRatio",
        type: "options",
        options: [
          { name: "9:16 (Reels/Shorts/TikTok)", value: "9:16" },
          { name: "1:1 (Square)", value: "1:1" },
          { name: "16:9 (Landscape)", value: "16:9" },
        ],
        default: "9:16",
        displayOptions: { show: { resource: ["video"], operation: ["create"] } },
      },
      {
        displayName: "AI Voiceover",
        name: "aiVoiceover",
        type: "boolean",
        default: false,
        displayOptions: { show: { resource: ["video"], operation: ["create"] } },
        description: "Add an AI-narrated voiceover track",
      },
      {
        displayName: "Voice ID",
        name: "voiceId",
        type: "string",
        default: "",
        displayOptions: { show: { resource: ["video"], operation: ["create"], aiVoiceover: [true] } },
        description: "Defaults to the account's default voice if left empty",
      },
      {
        displayName: "Scenes (JSON)",
        name: "scenes",
        type: "json",
        default: "",
        displayOptions: { show: { resource: ["video"], operation: ["create"] } },
        description: 'Advanced: multiple scenes instead of one prompt, e.g. [{"mediaSource":"ai","aiPrompt":"..."}]. Leave empty for the simple single-prompt path.',
      },
      {
        displayName: "Save As Draft",
        name: "saveAsDraft",
        type: "boolean",
        default: false,
        displayOptions: { show: { resource: ["video"], operation: ["create"] } },
        description: "Save without generating or charging credits — generate later from the dashboard",
      },
      {
        displayName: "Video ID",
        name: "videoId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["video"], operation: ["get", "delete"] } },
      },
      {
        displayName: "Limit",
        name: "videoLimit",
        type: "number",
        default: 25,
        displayOptions: { show: { resource: ["video"], operation: ["list"] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter("resource", i) as string;
      const operation = this.getNodeParameter("operation", i) as string;
      let method: IHttpRequestOptions["method"] = "GET";
      let path = "";
      let body: IDataObject | undefined;
      let qs: IDataObject | undefined;

      const jsonParam = (name: string): IDataObject | undefined => {
        const raw = this.getNodeParameter(name, i, "") as unknown;
        if (!raw) return undefined;
        return (typeof raw === "string" ? JSON.parse(raw) : raw) as IDataObject;
      };
      const strParam = (name: string, def?: string): string =>
        this.getNodeParameter(name, i, def === undefined ? "" : def) as string;

      if (resource === "account") {
        method = "GET"; path = "/accounts";
      } else if (resource === "credits") {
        method = "GET"; path = "/credits";
      } else if (resource === "post") {
        if (operation === "create") {
          method = "POST"; path = "/posts";
          body = {
            mediaUrl: strParam("mediaUrl"), mediaType: strParam("mediaType"),
            selections: jsonParam("selections"), caption: strParam("caption"),
            hashtags: strParam("hashtags") ? strParam("hashtags").split(",").map((h) => h.trim()).filter(Boolean) : [],
          };
        } else if (operation === "schedule") {
          method = "POST"; path = "/posts/scheduled";
          body = {
            mediaUrl: strParam("mediaUrl"), mediaType: strParam("mediaType"),
            selections: jsonParam("selections"), caption: strParam("caption"),
            hashtags: strParam("hashtags") ? strParam("hashtags").split(",").map((h) => h.trim()).filter(Boolean) : [],
            date: strParam("date"), time: strParam("time", "09:00"), timezone: strParam("timezone", "UTC"),
          };
        } else if (operation === "get") {
          method = "GET"; path = `/posts/${encodeURIComponent(strParam("postId"))}`;
        } else if (operation === "list") {
          method = "GET"; path = "/posts"; qs = { limit: this.getNodeParameter("limit", i, 25) };
        } else if (operation === "retry") {
          method = "POST"; path = `/posts/${encodeURIComponent(strParam("postId"))}/retry`;
          body = { platform: strParam("platform") };
        } else if (operation === "listScheduled") {
          method = "GET"; path = "/scheduled-posts"; qs = { limit: this.getNodeParameter("limit", i, 25) };
        } else if (operation === "reschedule") {
          method = "PATCH"; path = `/scheduled-posts/${encodeURIComponent(strParam("postId"))}`;
          body = { scheduledAtUtc: strParam("scheduledAtUtc") };
        } else if (operation === "deleteScheduled") {
          method = "DELETE"; path = `/scheduled-posts/${encodeURIComponent(strParam("postId"))}`;
        } else if (operation === "analytics") {
          method = "GET"; path = `/posts/${encodeURIComponent(strParam("postId"))}/analytics`;
          qs = { platform: strParam("analyticsPlatform") };
        }
      } else if (resource === "comment") {
        if (operation === "list") {
          method = "GET"; path = "/comments";
        } else if (operation === "reply") {
          method = "POST"; path = "/comments/reply";
          body = {
            platform: strParam("platform"), accountId: strParam("accountId"), commentId: strParam("commentId"),
            text: strParam("text"), directText: strParam("directText"),
          };
        } else if (operation === "dismiss") {
          method = "POST"; path = "/comments/dismiss";
          body = { platform: strParam("platform"), accountId: strParam("accountId"), commentId: strParam("commentId") };
        }
      } else if (resource === "pendingReply") {
        if (operation === "list") {
          method = "GET"; path = "/replies/pending";
        } else if (operation === "approve") {
          method = "POST"; path = `/replies/pending/${encodeURIComponent(strParam("pendingId"))}/approve`;
          body = { editedText: strParam("editedText") || undefined };
        } else if (operation === "reject") {
          method = "POST"; path = `/replies/pending/${encodeURIComponent(strParam("pendingId"))}/reject`;
        } else if (operation === "regenerate") {
          method = "POST"; path = `/replies/pending/${encodeURIComponent(strParam("pendingId"))}/regenerate`;
          body = { context: strParam("context") };
        } else if (operation === "updateText") {
          method = "PATCH"; path = `/replies/pending/${encodeURIComponent(strParam("pendingId"))}`;
          body = { text: strParam("text") };
        }
      } else if (resource === "webhook") {
        if (operation === "register") {
          method = "POST"; path = "/webhooks";
          body = { url: strParam("url"), events: this.getNodeParameter("events", i, []) };
        } else if (operation === "list") {
          method = "GET"; path = "/webhooks";
        } else if (operation === "delete") {
          method = "DELETE"; path = `/webhooks/${encodeURIComponent(strParam("webhookId"))}`;
        } else if (operation === "listDeliveries") {
          method = "GET"; path = `/webhooks/${encodeURIComponent(strParam("webhookId"))}/deliveries`;
        }
      } else if (resource === "rssFeed") {
        if (operation === "create") {
          method = "POST"; path = "/rss-feeds";
          body = {
            url: strParam("url"), selections: jsonParam("selections"),
            captionTemplate: strParam("captionTemplate"),
            checkIntervalMinutes: this.getNodeParameter("checkIntervalMinutes", i, 60),
          };
        } else if (operation === "list") {
          method = "GET"; path = "/rss-feeds";
        } else if (operation === "update") {
          method = "PATCH"; path = `/rss-feeds/${encodeURIComponent(strParam("feedId"))}`;
          body = {
            active: this.getNodeParameter("active", i, undefined),
            selections: jsonParam("selections"),
            captionTemplate: strParam("captionTemplate") || undefined,
            checkIntervalMinutes: this.getNodeParameter("checkIntervalMinutes", i, undefined),
          };
        } else if (operation === "delete") {
          method = "DELETE"; path = `/rss-feeds/${encodeURIComponent(strParam("feedId"))}`;
        } else if (operation === "checkNow") {
          method = "POST"; path = `/rss-feeds/${encodeURIComponent(strParam("feedId"))}/check-now`;
        }
      } else if (resource === "recyclingRule") {
        if (operation === "create") {
          method = "POST"; path = "/recycling-rules";
          body = {
            sourcePostId: strParam("sourcePostId"), selections: jsonParam("selections"),
            intervalDays: this.getNodeParameter("intervalDays", i, 30),
            rewriteCaption: this.getNodeParameter("rewriteCaption", i, false),
          };
        } else if (operation === "list") {
          method = "GET"; path = "/recycling-rules";
        } else if (operation === "update") {
          method = "PATCH"; path = `/recycling-rules/${encodeURIComponent(strParam("ruleId"))}`;
          body = {
            active: this.getNodeParameter("active", i, true),
            selections: jsonParam("selections"),
            intervalDays: this.getNodeParameter("intervalDays", i, undefined),
            rewriteCaption: this.getNodeParameter("rewriteCaption", i, undefined),
          };
        } else if (operation === "delete") {
          method = "DELETE"; path = `/recycling-rules/${encodeURIComponent(strParam("ruleId"))}`;
        } else if (operation === "runNow") {
          method = "POST"; path = `/recycling-rules/${encodeURIComponent(strParam("ruleId"))}/run-now`;
        }
      } else if (resource === "video") {
        if (operation === "create") {
          method = "POST"; path = "/videos";
          body = {
            prompt: strParam("videoPrompt"), aspectRatio: strParam("aspectRatio", "9:16"),
            aiVoiceover: this.getNodeParameter("aiVoiceover", i, false),
            voiceId: strParam("voiceId") || undefined,
            scenes: jsonParam("scenes"),
            saveAsDraft: this.getNodeParameter("saveAsDraft", i, false),
          };
        } else if (operation === "get") {
          method = "GET"; path = `/videos/${encodeURIComponent(strParam("videoId"))}`;
        } else if (operation === "list") {
          method = "GET"; path = "/videos"; qs = { limit: this.getNodeParameter("videoLimit", i, 25) };
        } else if (operation === "delete") {
          method = "DELETE"; path = `/videos/${encodeURIComponent(strParam("videoId"))}`;
        }
      }

      const options: IHttpRequestOptions = {
        method, url: BASE_URL + path, qs, body,
        json: true,
      };

      try {
        const response = await this.helpers.httpRequestWithAuthentication.call(this, "getMulticastApi", options);
        returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
