import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import querystring from 'querystring';
import SpotifyWebApi from 'spotify-web-api-js';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const STATE_KEY = 'spotify_auth_state';

const spotifyApi = new SpotifyWebApi({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI
});

app.use(cors())
  .use(cookieParser())
  .use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  res.cookie(STATE_KEY, state);

  const scope = 'user-read-private user-read-email user-library-read playlist-read-private playlist-modify-public';

  const authorizeURL = spotifyApi.createAuthorizeURL(scope, state);
  res.redirect(authorizeURL);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[STATE_KEY] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' + querystring.stringify({
      error: 'state_mismatch'
    }));
    return;
  }

  res.clearCookie(STATE_KEY);

  try {
    const data = await spotifyApi.authorizationCodeGrant(code);

    const access_token = data.body.access_token;
    const expires_in = data.body.expires_in;
    const refresh_token = data.body.refresh_token;

    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    res.redirect('/#' + querystring.stringify({
      access_token: access_token,
      expires_in: expires_in,
      refresh_token: refresh_token
    }));
  } catch (error) {
    res.redirect('/#' + querystring.stringify({
      error: 'invalid_token'
    }));
  }
});

app.get('/token/:type?', async (req, res) => {
  const type = req.params.type;

  try {
    if (type === 'refresh') {
      const refresh_token = req.query.refresh_token;
      if (!refresh_token) {
        res.status(401).send('Missing refresh token');
        return;
      }

      const data = await spotifyApi.refreshAccessToken(refresh_token);

      res.json(data.body);
    } else {
      const data = await spotifyApi.clientCredentialsGrant();

      res.json(data.body);
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/search', async (req, res) => {
  const query = req.query.query;
  const accessToken = req.query.access_token;

  // Instantiate a new SpotifyWebApi object with the access token
  const spotifyApiWith
