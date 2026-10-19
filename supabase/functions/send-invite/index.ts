import getCorsHeaders from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN");

const FROM_EMAIL = Deno.env.get('INVITE_FROM_EMAIL') || 'deepanshu@berglabs.ai'

type InvitePayload = {
  name: string
  email: string
  role: string
  inviteLink: string
}

function renderInviteEmailHtml(name: string, role: string, inviteLink: string): string {
  const safeName = name || 'there'
  const buttonUrl = inviteLink
  return `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>You're invited to Anvesana</title>
      <style>
        /* Reset */
        body { margin:0; padding:0; background:#f6f7fb; color:#111827; }
        img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
        table { border-collapse:collapse !important; }
        a { color:#1f2937; }
        /* Container */
        .wrapper { width:100%; background:#f6f7fb; padding:24px 0; }
        .container { max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
        .header { background:linear-gradient(135deg,#111827,#1f2937); padding:28px 32px; }
        .brand { color:#ffffff; font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size:20px; font-weight:600; letter-spacing:0.2px; }
        .content { padding:28px 32px; font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }
        h1 { margin:0 0 12px; font-size:22px; line-height:1.3; color:#111827; }
        p { margin:0 0 14px; font-size:14px; line-height:1.6; color:#374151; }
        .card { background:#f9fafb; border:1px solid #eef2f7; padding:16px; border-radius:10px; margin:16px 0 22px; }
        .btn { display:inline-block; background:#2563eb; color:#ffffff !important; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:600; font-size:14px; }
        .btn:hover { background:#1e4fd8; }
        .muted { color:#6b7280; font-size:12px; }
        .footer { padding:0 32px 28px; font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }
        @media (prefers-color-scheme: dark) {
          body { background:#0b0f17; color:#e5e7eb; }
          .container { background:#0f172a; box-shadow:0 2px 8px rgba(0,0,0,0.4); }
          .content h1 { color:#e5e7eb; }
          .content p { color:#cbd5e1; }
          .card { background:#0b1220; border-color:#192034; }
          .muted { color:#94a3b8; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <div class="container">
                <div class="header">
                  <div class="brand">Anvesana</div>
                </div>
                <div class="content">
                  <h1>You're invited to Anvesana</h1>
                  <p>Hi ${safeName},</p>
                  <p>You're receiving this because a manager has enrolled you in <strong>Anvesana Employee Tracker</strong>.</p>
                  <div class="card">
                    <p><strong>Your role:</strong> ${role}</p>
                    <p>Click the button below to accept your invitation and get started.</p>
                  </div>
                  <p>
                    <a class="btn" href="${buttonUrl}" target="_blank" rel="noopener">Accept invitation</a>
                  </p>
                  <p class="muted">If the button doesn't work, copy and paste this link into your browser:</p>
                  <p class="muted"><a href="${buttonUrl}" target="_blank" rel="noopener">${buttonUrl}</a></p>
                </div>
                <div class="footer">
                  <p class="muted">This invite link is unique to you. If you weren't expecting this, you can safely ignore this email.</p>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </div>
    </body>
  </html>
  `
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(ALLOWED_ORIGIN || "*");
  const requestId = (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const startedAt = performance.now()
  const logPrefix = `[send-invite][${requestId}]`

  try {
    console.log(`${logPrefix} Incoming request`, {
      method: req.method,
      url: req.url,
      origin: req.headers.get('origin') || null,
      contentType: req.headers.get('content-type') || null,
      hasResendKey: Boolean(RESEND_API_KEY),
      allowedOrigin: ALLOWED_ORIGIN || '*',
      fromEmail: FROM_EMAIL
    })

  // Needed for CORS
  if (req.method === "OPTIONS") {
    console.log(`${logPrefix} Preflight OPTIONS`, { corsHeaders })
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders 
    });
  }

  if (req.method !== 'POST') {
    console.warn(`${logPrefix} Method not allowed`, { method: req.method })
    return new Response(JSON.stringify({
      error: true,
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Only POST method is allowed',
      timestamp: new Date().toISOString()
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let payload: InvitePayload
  try {
    payload = await req.json()
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/ae5c929b-a368-47a0-9b09-fb93832ffb13', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'send-invite/index.ts:payload', message: 'Edge function received request', data: { hasName: Boolean(payload?.name), email: payload?.email ?? null, hasInviteLink: Boolean(payload?.inviteLink), hasRole: Boolean(payload?.role) }, timestamp: Date.now(), hypothesisId: 'H5' }) }).catch(() => {});
    // #endregion
    console.log(`${logPrefix} Parsed JSON payload`, {
      hasName: Boolean(payload?.name),
      email: payload?.email || null,
      role: payload?.role || null,
      inviteLinkPresent: Boolean(payload?.inviteLink)
    })
  } catch (e) {
    console.error(`${logPrefix} Invalid JSON`, { error: String(e) })
    return new Response(JSON.stringify({
      error: true,
      errorCode: 'INVALID_JSON',
      errorMessage: 'Invalid JSON body provided',
      timestamp: new Date().toISOString()
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { name, email, role, inviteLink } = payload || {}
  
  // Validate required fields
  const missingFields = []
  if (!email) missingFields.push('email')
  if (!role) missingFields.push('role')
  if (!inviteLink) missingFields.push('inviteLink')
  
  if (missingFields.length > 0) {
    console.warn(`${logPrefix} Missing required fields`, { missingFields })
    return new Response(JSON.stringify({
      error: true,
      errorCode: 'MISSING_REQUIRED_FIELDS',
      errorMessage: `Missing required fields: ${missingFields.join(', ')}`,
      missingFields,
      timestamp: new Date().toISOString()
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.warn(`${logPrefix} Invalid email format`, { email })
    return new Response(JSON.stringify({
      error: true,
      errorCode: 'INVALID_EMAIL_FORMAT',
      errorMessage: 'Invalid email format provided',
      timestamp: new Date().toISOString()
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!RESEND_API_KEY) {
    console.error(`${logPrefix} Missing RESEND_API_KEY`)
    return new Response(JSON.stringify({
      error: true,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'RESEND_API_KEY environment variable is not configured',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const subject = `You're invited to be a ${role} at Anvesana`
  const html = renderInviteEmailHtml(name, role, inviteLink)

  console.log(`${logPrefix} Sending email via Resend`, {
    to: email,
    from: FROM_EMAIL,
    subject,
    inviteLinkLength: inviteLink?.length || 0
  })

  let res: Response
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Anvesana <${FROM_EMAIL}>`,
        to: email,
        subject,
        html,
      }),
    })
  } catch (e) {
    const durationMs = Math.round(performance.now() - startedAt)
    console.error(`${logPrefix} Network error calling Resend`, { error: String(e), durationMs })
    return new Response(JSON.stringify({
      error: true,
      errorCode: 'EMAIL_SEND_REQUEST_FAILED',
      errorMessage: 'Failed to call email provider',
      timestamp: new Date().toISOString()
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let data: any = null
  try {
    data = await res.json()
  } catch (e) {
    console.warn(`${logPrefix} Failed to parse Resend response JSON`, { error: String(e) })
  }
  console.log(`${logPrefix} Resend response`, { status: res.status, ok: res.ok, data })

  if (!res.ok) {
    // Handle specific Resend API errors
    let errorCode = 'EMAIL_SEND_FAILED'
    let errorMessage = 'Failed to send invite email'
    let statusCode = 502

    if (data?.name === 'validation_error') {
      if (data?.error?.includes('domain is not verified')) {
        errorCode = 'DOMAIN_NOT_VERIFIED'
        errorMessage = 'Email domain is not verified. Please verify your domain in Resend dashboard.'
        statusCode = 400
      } else if (data?.error?.includes('invalid email')) {
        errorCode = 'INVALID_EMAIL'
        errorMessage = 'Invalid email address provided.'
        statusCode = 400
      } else {
        errorCode = 'VALIDATION_ERROR'
        errorMessage = data?.error || 'Email validation failed'
        statusCode = 400
      }
    } else if (data?.name === 'rate_limit_exceeded') {
      errorCode = 'RATE_LIMIT_EXCEEDED'
      errorMessage = 'Too many email requests. Please try again later.'
      statusCode = 429
    } else if (data?.name === 'authentication_error') {
      errorCode = 'AUTHENTICATION_ERROR'
      errorMessage = 'Invalid API key or authentication failed.'
      statusCode = 401
    } else if (res.status === 403) {
      errorCode = 'FORBIDDEN'
      errorMessage = 'Access denied. Check your API key and permissions.'
      statusCode = 403
    }

    console.error(`${logPrefix} Resend error`, { errorCode, errorMessage, statusCode, data })
    const durationMs = Math.round(performance.now() - startedAt)
    return new Response(JSON.stringify({
      error: true,
      errorCode,
      errorMessage,
      details: data,
      requestId,
      durationMs,
      timestamp: new Date().toISOString()
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const durationMs = Math.round(performance.now() - startedAt)
  console.log(`${logPrefix} Email sent successfully`, { id: data?.id || null, durationMs })

  return new Response(JSON.stringify({ 
    success: true, 
    id: data?.id || null,
    message: 'Invite email sent successfully',
    requestId,
    durationMs
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
  } catch (e) {
    const durationMs = Math.round(performance.now() - startedAt)
    console.error(`${logPrefix} Unhandled error`, { error: String(e), durationMs })
    return new Response(JSON.stringify({
      error: true,
      errorCode: 'UNHANDLED_ERROR',
      errorMessage: 'Unexpected server error',
      requestId,
      durationMs,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

Deno.serve(handler)
