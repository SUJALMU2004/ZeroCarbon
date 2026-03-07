type TwilioVerifyErrorCode =
  | "invalid_phone"
  | "invalid_code"
  | "expired_code"
  | "rate_limited"
  | "provider_error"
  | "configuration_error"
  | "unknown";

type TwilioApiErrorPayload = {
  code?: number;
  message?: string;
  more_info?: string;
  status?: number;
};

export class TwilioVerifyError extends Error {
  code: TwilioVerifyErrorCode;
  status: number;

  constructor(message: string, code: TwilioVerifyErrorCode, status = 500) {
    super(message);
    this.name = "TwilioVerifyError";
    this.code = code;
    this.status = status;
  }
}

function getTwilioEnv() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    throw new TwilioVerifyError(
      "Phone verification service is not configured.",
      "configuration_error",
      500,
    );
  }

  return {
    accountSid,
    authToken,
    serviceSid,
  };
}

function getBasicAuthHeader(accountSid: string, authToken: string): string {
  const token = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  return `Basic ${token}`;
}

function normalizeTwilioError(
  payload: TwilioApiErrorPayload | null,
  httpStatus: number,
): TwilioVerifyError {
  const message = payload?.message ?? "";

  if (httpStatus === 400 && /phone|e\.164|to parameter|destination/i.test(message)) {
    return new TwilioVerifyError(
      "Please enter a valid phone number (e.g. +919876543210).",
      "invalid_phone",
      400,
    );
  }

  if (httpStatus === 400 && /code|otp|verification check|not valid|incorrect/i.test(message)) {
    return new TwilioVerifyError("Invalid OTP. Please try again.", "invalid_code", 400);
  }

  if (httpStatus === 404 || /expired|max check attempts reached/i.test(message)) {
    return new TwilioVerifyError("OTP expired. Please request a new code.", "expired_code", 400);
  }

  if (httpStatus === 429 || /rate|too many|limit/i.test(message)) {
    return new TwilioVerifyError("Too many attempts. Please wait and retry.", "rate_limited", 429);
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return new TwilioVerifyError(
      "Phone verification provider credentials are invalid.",
      "configuration_error",
      500,
    );
  }

  if (message) {
    return new TwilioVerifyError(
      "Phone verification service is temporarily unavailable. Please try again.",
      "provider_error",
      502,
    );
  }

  return new TwilioVerifyError(
    "Unable to process phone verification right now. Please try again.",
    "unknown",
    500,
  );
}

async function twilioVerifyRequest(
  endpoint: string,
  formBody: Record<string, string>,
): Promise<unknown> {
  const { accountSid, authToken, serviceSid } = getTwilioEnv();
  const url = `https://verify.twilio.com/v2/Services/${serviceSid}/${endpoint}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(accountSid, authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(formBody).toString(),
    cache: "no-store",
  });

  const responseText = await response.text();
  let payload: unknown = null;
  try {
    payload = responseText ? (JSON.parse(responseText) as unknown) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw normalizeTwilioError(
      (payload as TwilioApiErrorPayload | null) ?? null,
      response.status,
    );
  }

  return payload;
}

type TwilioSendVerificationResult = {
  sid: string | null;
  status: string | null;
};

type TwilioCheckVerificationResult = {
  status: string | null;
  isApproved: boolean;
};

export async function sendTwilioVerification(params: {
  to: string;
}): Promise<TwilioSendVerificationResult> {
  const payload = (await twilioVerifyRequest("Verifications", {
    To: params.to,
    Channel: "sms",
  })) as { sid?: string; status?: string };

  return {
    sid: payload?.sid ?? null,
    status: payload?.status ?? null,
  };
}

export async function checkTwilioVerification(params: {
  to: string;
  code: string;
}): Promise<TwilioCheckVerificationResult> {
  const payload = (await twilioVerifyRequest("VerificationCheck", {
    To: params.to,
    Code: params.code,
  })) as { status?: string };

  const status = payload?.status ?? null;
  return {
    status,
    isApproved: status === "approved",
  };
}
