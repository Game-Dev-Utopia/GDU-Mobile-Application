import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;
  const scope = 'identify email';

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Discord OAuth not configured' }, { status: 500 });
  }

  const state = crypto.randomUUID();

  const discordAuthUrl =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(discordAuthUrl);
}
