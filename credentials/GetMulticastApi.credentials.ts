import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  Icon,
  INodeProperties,
} from "n8n-workflow";

export class GetMulticastApi implements ICredentialType {
  name = "getMulticastApi";

  displayName = "GetMulticast API";

  documentationUrl = "https://getmulticast.com/api-docs.html";

  icon: Icon = { light: "file:getmulticast.svg", dark: "file:getmulticast.svg" };

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "Create one at getmulticast.com → Settings → Developer → New API key.",
    },
  ];

  // How n8n attaches this credential to every request made with it —
  // avoids repeating the Authorization header on every node operation.
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        Authorization: "=Bearer {{$credentials.apiKey}}",
      },
    },
  };

  // A cheap, real read-only call n8n uses for the credential's "Test" button.
  test: ICredentialTestRequest = {
    request: {
      baseURL: "https://getmulticast.com/api/v1",
      url: "/credits",
    },
  };
}
