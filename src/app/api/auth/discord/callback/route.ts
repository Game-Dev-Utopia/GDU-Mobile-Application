import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const STATE_COOKIE = 'discord_oauth_state';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${siteUrl}/landing?error=${encodeURIComponent(code)}`);
    res.cookies.set(STATE_COOKIE, '', { path: '/api/auth/discord', maxAge: 0 });
    return res;
  };

  const code = searchParams.get('code');
  const error = searchParams.get('error');
  if (error) return fail(error);
  if (!code) return fail('no_code');

  // CSRF check: the state Discord echoes back must match the one set in this browser.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const returnedState = searchParams.get('state');
  if (!expectedState || !returnedState || expectedState !== returnedState) {
    return fail('invalid_state');
  }

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET; // server-only, never NEXT_PUBLIC_
  const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return fail('oauth_not_configured');

  try {
    // 1. Exchange the code for a Discord access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) {
      console.error('Discord token exchange failed:', tokenResponse.status);
      return fail('token_exchange_failed');
    }
    const { access_token: accessToken } = await tokenResponse.json();

    // 2. Fetch the Discord profile
    const profileResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileResponse.ok) {
      console.error('Discord profile fetch failed:', profileResponse.status);
      return fail('profile_fetch_failed');
    }
    const discordUser = await profileResponse.json();
    const discordId: string = discordUser.id;
    const discordUsername: string = discordUser.username;
    const email: string | undefined = discordUser.email?.toLowerCase();
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
      : null;

    if (!email) return fail('email_required');
    // An unverified Discord email must never be used to claim an existing account.
    if (discordUser.verified !== true) return fail('email_not_verified');

    // 3. Find or create the Supabase user (service role, server only)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    let userId: string | null = null;

    const { data: linked } = await admin
      .from('profiles')
      .select('id')
      .eq('discord_id', discordId)
      .maybeSingle();
    if (linked?.id) userId = linked.id;

    if (!userId) {
      // Walk every page of users, not just the first.
      for (let page = 1; !userId; page++) {
        const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listError) throw listError;
        const hit = data.users.find((u) => u.email?.toLowerCase() === email);
        if (hit) userId = hit.id;
        if (data.users.length < 200) break;
      }
    }

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          username: discordUsername,
          display_name: discordUsername,
          discord_id: discordId,
        },
      });
      if (createError || !created?.user) {
        console.error('Failed to create Supabase user:', createError?.message);
        return fail('user_creation_failed');
      }
      userId = created.user.id;
    }

    // The auth.users trigger creates the profile row; just attach the Discord identity to it.
    const { error: linkError } = await admin
      .from('profiles')
      .update({ discord_id: discordId, avatar_url: avatar })
      .eq('id', userId);
    if (linkError) {
      console.error('Failed to link Discord identity:', linkError.message);
      return fail('profile_link_failed');
    }

    // 4. Sign in without a password: mint a one-time magic-link token and redeem it here,
    //    which sets the session cookies on this response.
    const { data: link, error: linkGenError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkGenError || !tokenHash) {
      console.error('Failed to generate sign-in token:', linkGenError?.message);
      return fail('sign_in_failed');
    }

    const response = NextResponse.redirect(`${siteUrl}/`);
    response.cookies.set(STATE_COOKIE, '', { path: '/api/auth/discord', maxAge: 0 });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set(name, '', { ...options, maxAge: 0 });
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set(name, value, options);
          },
        },
      }
    );

    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });
    if (otpError) {
      console.error('Supabase sign in failed:', otpError.message);
      return fail('sign_in_failed');
    }

    return response;
  } catch (err) {
    console.error('Discord OAuth callback error:', err);
    return fail('callback_error');
  }
}
