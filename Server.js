require('dotenv').config();

const request = require('request');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const querystring = require('querystring');
const fetch = require('node-fetch');
const SpotifyWebApi = require('spotify-web-api-js');

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
  .use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
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

  try {
    const data = await spotifyApi.searchTracks(query, { limit: 1, offset: 0, market: 'US' });

    if (!data.body.tracks.items || data.body.tracks.items.length === 0) {
      res.status(404).send('No tracks found');
      return;
    }

    const track = data.body.tracks.items[0];
    const audioFeatures = await spotifyApi.getAudioFeaturesForTrack(track.id);

    res.json(audioFeatures);
  } catch (error) {
    res.status(500).send(error.message);
  }
});


app.get('/similar-songs', async (req, res) => {
  const songName = req.query.songName;

  try {
    const { access_token } = await getAccessToken();
    spotifyApi.setAccessToken(access_token);

    const track = await searchTrack(songName);
    if (!track) {
      res.status(404).send('Could not find a track with that name');
      return;
    }

    const audioFeatures = await getAudioFeatures(track.id);
    const similarSongs = await findSimilarSongs(audioFeatures.uri);

    res.json(similarSongs);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

async function searchTrack(query) {
  const { body } = await spotifyApi.searchTracks(`track:${query}`, { limit: 1 });
  if (!body.tracks.items || body.tracks.items.length === 0) {
    return null;
  }
  return body.tracks.items[0];
}

async function getAudioFeatures(trackId) {
  const { body } = await spotifyApi.getAudioFeaturesForTrack(trackId);
  return body;
}

async function findSimilarSongs(trackId) {
  const { body } = await spotifyApi.getRecommendations({
    limit: 5,
    seed_tracks: [trackId],
  });
  return body.tracks;
}

async function getAccessToken() {
  const { body } = await request.post({
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64')}`,
    },
    form: {
      grant_type: 'client_credentials',
    },
    json: true,
  });
  return body;
}
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

