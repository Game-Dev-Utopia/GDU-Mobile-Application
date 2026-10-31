import { NextResponse } from 'next/server';

const STATE_COOKIE = 'discord_oauth_state';

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;
  const scope = 'identify email';

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Discord OAuth not configured' }, { status: 500 });
  }

  // Random per-login value, bound to this browser by an httpOnly cookie and checked in the callback.
  const state = crypto.randomUUID();

  const discordAuthUrl =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  const response = NextResponse.redirect(discordAuthUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/discord',
    maxAge: 600,
  });
  return response;
}
