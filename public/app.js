import SpotifyWebApi from 'spotify-web-api-js';

const spotifyApi = new SpotifyWebApi({
  clientId: '951ccbe3f9a34e04a968f3e692bdb550',
  clientSecret: '257a2e639d214d018d5e5dd70e7fee58',
  redirectUri: 'http://localhost:3000/callback',
});

function getURLParams() {
  const searchParams = new URLSearchParams(window.location.search.substring(1));
  const params = {};
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }
  return params;
}

async function searchTrack(query, accessToken) {
  spotifyApi.setAccessToken(accessToken);
  const data = await spotifyApi.searchTracks(query, { limit: 1 });
  if (!data.tracks.items || data.tracks.items.length === 0) {
    return null;
  }
  return data.tracks.items[0];
}

async function findSimilarSongs(audioFeatures, accessToken) {
  spotifyApi.setAccessToken(accessToken);
  const data = await spotifyApi.getRecommendations({
    limit: 5,
    seed_tracks: [audioFeatures.id],
  });
  return data.tracks;
}

function clearInput() {
  document.getElementById('song-name').value = '';
  document.getElementById('song-name').focus();

  const similarSongsTable = document.getElementById('similar-songs-table');
  if (similarSongsTable) {
    similarSongsTable.style.display = 'none';
  }

  const similarSongsList = document.getElementById('similar-songs');
  if (similarSongsList) {
    similarSongsList.innerHTML = '';
  }
}

function clearTable() {
  // Clear the input field and focus on it
  document.getElementById('song-name').value = '';
  document.getElementById('song-name').focus();

  // Clear the table by removing its rows
  const tableBody = document.getElementById('similar-songs');
  while (tableBody.firstChild) {
    tableBody.removeChild(tableBody.firstChild);
  }

  // Hide the table
  const similarSongsTable = document.getElementById('similar-songs-table');
  similarSongsTable.style.display = 'none';
}


async function main() {
  let accessToken = getURLParams().access_token;

  if (!accessToken) {
    fetch('/token').then((res) => {
      res.json().then((data) => {
        accessToken = data.access_token;
      });
    });
  }

  document.getElementById('song-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const songName = document.getElementById('song-name').value;
    if (!songName) {
      alert('Please enter a song name');
      return;
    }

    const track = await searchTrack(songName, accessToken);
    if (!track) {
      alert('Could not find a track with that name');
      return;
    } 

    const audioFeatures = await spotifyApi.getAudioFeaturesForTrack(track.id);

    const similarSongs = await findSimilarSongs(audioFeatures, accessToken);

    const similarSongsTable = document.getElementById('similar-songs-table');
    similarSongsTable.style.display = 'table';
    const similarSongsList = document.getElementById('similar-songs');
    similarSongsList.innerHTML = '';

    if (similarSongs.length === 0) {
      const listItem = document.createElement('li');
      listItem.textContent = 'No similar songs found';
      similarSongsList.appendChild(listItem);
    } else {
      for (const song of similarSongs) {
        const songName = song.name;
        const artist = song.artists[0].name;
        const releaseYear = new Date(song.album.release_date).getFullYear();

        const tr = document.createElement('tr');

        const tdTitle = document.createElement('td');
        tdTitle.textContent = songName;
        tr.appendChild(tdTitle);

        const tdArtist = document.createElement('td');
        tdArtist.textContent = artist;
        tr.appendChild(tdArtist);

      

        const tdYear = document.createElement('td');
        tdYear.textContent = releaseYear;
        tr.appendChild(tdYear);

        similarSongsList.appendChild(tr);
      }
    }
  });
}

main();