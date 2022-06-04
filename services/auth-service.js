const jwtDecode = require('jwt-decode');
const axios = require('axios');
const url = require('url');
const envVariables = require('../env-variables');
const keytar = require('keytar');
const os = require('os');
const qs = require('querystring');
const crypto = require('crypto');

const { oauthDomain, clientId } = envVariables;

function base64URLEncode (str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
function sha256 (buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

const verifier = base64URLEncode(crypto.randomBytes(32));
const challenge = base64URLEncode(sha256(verifier));

const redirectUri = 'http://localhost/callback';

const keytarService = 'electron-openid-oauth';
const keytarAccount = os.userInfo().username;

let accessToken = null;
let profile = null;
let refreshToken = null;

function getAccessToken () {
  return accessToken;
}

function getProfile () {
  return profile;
}

function getAuthenticationURL () {
  const params = {
    scope: 'openid profile offline_access site.read file_storage.read file_storage.download resource_owner.read resource_owner.write user.profile user.read',
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    prompt: 'login'
  }

  return `https://${oauthDomain}/connect/authorize?${qs.stringify(params)}`
}

async function refreshTokens () {
  const refreshToken = await keytar.getPassword(keytarService, keytarAccount);

  if (refreshToken) {
    const refreshOptions = {
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken
    };

    const options = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    try {
      const response = await axios.post(`https://${oauthDomain}/connect/token`, qs.stringify(refreshOptions), options);
      accessToken = response.data.access_token;
    } catch (error) {
      await logout();
      throw error;
    }
  } else {
    throw new Error('No available refresh token.');
  }
}

async function loadTokens (callbackURL) {
  const urlParts = url.parse(callbackURL, true);
  const query = urlParts.query;

  const exchangeOptions = {
    grant_type: 'authorization_code',
    client_id: clientId,
    code: query.code,
    redirect_uri: redirectUri,
    code_verifier: verifier
  };

  const options = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  try {
    const response = await axios.post(`https://${oauthDomain}/connect/token`, qs.stringify(exchangeOptions), options);

    accessToken = response.data.access_token;
    profile = jwtDecode(response.data.id_token);
    refreshToken = response.data.refresh_token;

    if (refreshToken) {
      await keytar.setPassword(keytarService, keytarAccount, refreshToken);
    }
  } catch (error) {
    await logout();

    throw error;
  }
}

async function logout () {
  await keytar.deletePassword(keytarService, keytarAccount);
  accessToken = null;
  profile = null;
  refreshToken = null;
}

function getLogOutUrl () {
  return `https://${oauthDomain}/v2/logout`;
}

module.exports = {
  getAccessToken,
  getAuthenticationURL,
  getLogOutUrl,
  getProfile,
  loadTokens,
  logout,
  refreshTokens
};