import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/landing?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/landing?error=no_code`);
  }

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const clientSecret = process.env.NEXT_PUBLIC_DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/landing?error=oauth_not_configured`
    );
  }

  try {
    // 1. Exchange code for Discord access token
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
      console.error('Discord token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/landing?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Get Discord user profile
    const profileResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileResponse.ok) {
      console.error('Discord profile fetch failed:', await profileResponse.text());
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/landing?error=profile_fetch_failed`
      );
    }

    const discordUser = await profileResponse.json();
    const discordId = discordUser.id;
    const discordEmail = discordUser.email;
    const discordUsername = discordUser.username;
    let discordAvatar: string | null = null;
    if (discordUser.avatar) {
      discordAvatar = `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`;
    }

    if (!discordEmail) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/landing?error=email_required`
      );
    }

    // 3. Use Supabase service role to find or create the auth user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const randomPassword = Math.random().toString(36).slice(-20);

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    let profileId: string;

    if (existingProfile?.id) {
      profileId = existingProfile.id;
    } else {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = authUsers.users.find((u) => u.email === discordEmail);

      if (existingUser) {
        profileId = existingUser.id;
        await supabaseAdmin
          .from('profiles')
          .update({ discord_id: discordId })
          .eq('id', existingUser.id);
      } else {
        const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser(
          {
            email: discordEmail,
            password: randomPassword,
            email_confirm: true,
            user_metadata: {
              username: discordUsername,
              display_name: discordUsername,
              discord_id: discordId,
            },
          }
        );

        if (createError || !createdUser?.user) {
          console.error('Failed to create Supabase user:', createError);
          return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_SITE_URL}/landing?error=user_creation_failed`
          );
        }

        profileId = createdUser.user.id;

        await supabaseAdmin.from('profiles').insert({
          id: profileId,
          username: discordUsername,
          display_name: discordUsername,
          avatar_url: discordAvatar,
          discord_id: discordId,
          role: 'member',
          onboarding_complete: false,
          total_exp: 0,
          level: 1,
          league_tier: 'obsidian',
        });
      }
    }

    // 4. Sign in using SSR client to set session cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set(name, value, options);
          },
        },
      }
    );

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: discordEmail,
      password: randomPassword,
    });

    if (signInError) {
      console.error('Supabase sign in failed:', signInError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/landing?error=sign_in_failed`
      );
    }

    // 5. Redirect to home
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/`);
  } catch (err) {
    console.error('Discord OAuth callback error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/landing?error=callback_error`
    );
  }
}
