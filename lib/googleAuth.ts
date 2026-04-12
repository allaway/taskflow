import { google } from "googleapis";

/** Creates an OAuth2 client used for API calls (not the initial auth flow). */
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // redirect_uri is not needed for token refresh — only for the initial code exchange
    undefined,
  );
}
