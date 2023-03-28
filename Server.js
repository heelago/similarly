const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const querystring = require('querystring');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

const CLIENT_ID = '951ccbe3f9a34e04a968f3e692bdb550';
const CLIENT_SECRET = '257a2e639d214d018d5e5dd70e7fee58';
const REDIRECT_URI = 'https://similarly.herokuapp.com/callback';
const STATE_KEY = 'spotify_auth_state';

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

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: scope,
      redirect_uri: REDIRECT_URI,
      state: state
    }));
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

  const params = new URLSearchParams();
  params.append('code', code);
  params.append('redirect_uri', REDIRECT_URI);
  params.append('grant_type', 'authorization_code');

  const auth = 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': auth
  };

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      body: params,
      headers: headers
    });

    const data = await response.json();

    const access_token = data.access_token;
    const expires_in = data.expires_in;
    const refresh_token = data.refresh_token;

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
  const authOptions = {
    method: 'POST',
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + (new Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {
      grant_type: 'client_credentials'
    },
    json: true
  };

  try {
    const response = await fetch(authOptions.url, {
      method: authOptions.method,
      body: querystring.stringify(authOptions.form),
      headers: authOptions.headers
    });

    const data = await response.json();

    const access_token = data.access_token;
    const expires_in = data.expires_in;

    if (type === 'refresh') {
      const refresh_token = req.query.refresh_token;
      if (!refresh_token) {
        res.status(401).send('Missing refresh token');
        return;
      }

      const refreshParams = new URLSearchParams();
      refreshParams.append('grant_type', 'refresh_token');
      refreshParams.append('refresh_token', refresh_token);

      const refreshResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        body: refreshParams,
        headers: {
          'Authorization': 'Basic ' + (new Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const refreshData = await refreshResponse.json();
      res.json(refreshData);
    } else {
      res.json(data);
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}
