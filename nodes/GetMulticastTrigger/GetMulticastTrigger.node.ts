import * as crypto from "crypto";
import type {
  IHookFunctions,
  IWebhookFunctions,
  IWebhookResponseData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import { NodeConnectionTypes } from "n8n-workflow";

const BASE_URL = "https://getmulticast.com/api/v1";

interface GetMulticastWebhookStaticData {
  webhookId?: string;
  webhookSecret?: string;
}

interface RegisteredWebhook {
  id: string;
  url: string;
}

// Real webhook lifecycle management — activating this node's workflow
// registers a real webhook (POST /webhooks) pointing at n8n's own
// webhook URL; deactivating it removes that registration (DELETE
// /webhooks/{id}). This is the standard n8n trigger-node pattern
// (checkExists/create/delete), not a manual "paste this URL into
// GetMulticast yourself" step — activate the workflow and it's wired.
export class GetMulticastTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "GetMulticast Trigger",
    name: "getMulticastTrigger",
    icon: "file:getmulticast.svg",
    group: ["trigger"],
    version: 1,
    subtitle: '={{$parameter["events"].join(", ")}}',
    description: "Starts the workflow on a real GetMulticast event (post published/failed, comment received, reply sent)",
    defaults: { name: "GetMulticast Trigger" },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: "getMulticastApi", required: true }],
    webhooks: [
      {
        name: "default",
        httpMethod: "POST",
        responseMode: "onReceived",
        path: "webhook",
      },
    ],
    properties: [
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
        default: ["post.published", "post.failed"],
        required: true,
        description: "Which real GetMulticast events should start this workflow",
      },
    ],
  };

  // n8n calls these when the workflow containing this node is
  // activated/deactivated/saved — this is what makes the webhook
  // registration automatic instead of a manual dashboard step.
  webhookMethods = {
    default: {
      checkExists: async function (this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl("default");
        const staticData = this.getWorkflowStaticData("node") as GetMulticastWebhookStaticData;
        if (!staticData.webhookId) return false;
        try {
          const resp = (await this.helpers.httpRequestWithAuthentication.call(this, "getMulticastApi", {
            method: "GET", url: `${BASE_URL}/webhooks`, json: true,
          })) as { webhooks?: RegisteredWebhook[] };
          const stillThere = (resp.webhooks || []).some((w) => w.id === staticData.webhookId && w.url === webhookUrl);
          if (!stillThere) {
            // Registered previously (e.g. from another n8n instance/restore)
            // but gone now — clear the stale id so create() runs fresh
            // instead of silently doing nothing forever.
            delete staticData.webhookId;
            delete staticData.webhookSecret;
            return false;
          }
          return true;
        } catch {
          return false;
        }
      },
      create: async function (this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl("default");
        const events = this.getNodeParameter("events") as string[];
        if (!events || !events.length) {
          throw new Error("Select at least one event for this trigger");
        }
        const resp = (await this.helpers.httpRequestWithAuthentication.call(this, "getMulticastApi", {
          method: "POST", url: `${BASE_URL}/webhooks`, body: { url: webhookUrl, events }, json: true,
        })) as { id: string; secret: string };
        const staticData = this.getWorkflowStaticData("node") as GetMulticastWebhookStaticData;
        staticData.webhookId = resp.id;
        // The signing secret is returned ONLY this once (same one-time-
        // reveal pattern as API keys) — captured here into the
        // workflow's own static data so webhook() below can verify
        // every future delivery's signature. n8n encrypts workflow
        // static data at rest the same way it encrypts credentials.
        staticData.webhookSecret = resp.secret;
        return true;
      },
      delete: async function (this: IHookFunctions): Promise<boolean> {
        const staticData = this.getWorkflowStaticData("node") as GetMulticastWebhookStaticData;
        if (!staticData.webhookId) return true;
        try {
          await this.helpers.httpRequestWithAuthentication.call(this, "getMulticastApi", {
            method: "DELETE", url: `${BASE_URL}/webhooks/${staticData.webhookId}`, json: true,
          });
        } catch {
          // Already gone (e.g. deleted from the GetMulticast dashboard
          // directly) — not a reason to block deactivating the workflow.
        }
        delete staticData.webhookId;
        delete staticData.webhookSecret;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const staticData = this.getWorkflowStaticData("node") as GetMulticastWebhookStaticData;
    const req = this.getRequestObject();
    const bodyData = this.getBodyData();
    const headerData = this.getHeaderData();

    if (staticData.webhookSecret) {
      const signatureHeader = headerData["x-getmulticast-signature"];
      const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(bodyData);
      const expected = "sha256=" + crypto.createHmac("sha256", staticData.webhookSecret).update(rawBody).digest("hex");
      const valid = typeof signatureHeader === "string"
        && signatureHeader.length === expected.length
        && crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
      if (!valid) {
        // Real security check, not decorative — reject anything that
        // isn't genuinely signed by this webhook's own secret, same as
        // the verification example in the API docs.
        return { webhookResponse: { status: 401, body: { error: "invalid_signature" } } };
      }
    }

    return {
      workflowData: [this.helpers.returnJsonArray([bodyData])],
    };
  }
}
