/*
USAGE NOTES 

LOGGING IN: Jasmine’s credentials work here for any user to login, just make sure…
  1) User is added to user list (see https://developer.spotify.com/dashboard/27355b6bf834496e8d4a0ebee545f18c/users, use Jasmine’s login)

  2) Session is brand new (Spotify does some weird cache thing)

  3) User has made some Spotify app in the past (so they have some existing Spotify secret & id... yeah, a HUGE pain, I know...)

APP WON'T START
  1) Assuming you've already tried starting a fresh new session...

  2) Try npm install & npm start again... That should do the trick...
*/

import express from "express";
import fetch from "node-fetch";

const app = express();

app.set("views", "./views");
app.set("view engine", "pug");

app.use(express.static("public"));
//app.use(express.json());

//////////////////////
// GLOBAL VARIABLES //
// To store ALL tracks that aren't in Top 50 or Most Recent 50!
let REWRAPPED_TRACKS = new Map();
  // Key: Track ID
  // Value: 
        //name: track.name,
        //preview_url: track.preview_url,
        //artists: track.artists,
        //album_cover: track.album.images[0].url
let USER_INFO = ''
let USER_PLAYLISTS = []
let PLAYLIST_SELECTED = []
//////////////////////
//////////////////////

// Jasmine's credientials below! Should NOT have to change them!
const redirect_uri = "https://rewrapped-16ed9a924597.herokuapp.com/callback" // "http://localhost:3000/callback";
const client_id = "27355b6bf834496e8d4a0ebee545f18c";
const client_secret = "a9b83d2bf5b94583a470ec3e52612dae";
global.access_token;

app.get("/", function (req, res) {
  console.log('HEY! Login page loaded!')
  res.render("index");

  // We assume user has logged out
  console.log('CLEARING USER DATA!')
  REWRAPPED_TRACKS = new Map()
  USER_INFO = ''
  PLAYLIST_SELECTED = []
  USER_PLAYLISTS = []
});

app.get("/authorize", (req, res) => {
  console.log('HEY! Login button clicked!')

  var auth_query_parameters = new URLSearchParams({
    response_type: "code",
    client_id: client_id,
    scope: [
        "user-library-read", 
        "user-top-read", 
        "user-read-recently-played", 
        "playlist-modify-public", 
        "playlist-modify-private",
        "user-read-currently-playing",
        "user-read-playback-state",
        "user-modify-playback-state",
        "playlist-read-collaborative",
        "playlist-read-private"
    ], 
    redirect_uri: redirect_uri,
    show_dialog: true
  });

  res.redirect(
    "https://accounts.spotify.com/authorize?" + auth_query_parameters.toString()
  );
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  console.log('HEY! LOGGING IN...')

  var body = new URLSearchParams({
    code: code,
    redirect_uri: redirect_uri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "post",
    body: body,
    headers: {
      "Content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(client_id + ":" + client_secret).toString("base64"),
    },
  });

  const data = await response.json();
  global.access_token = data.access_token;

  res.redirect("/dashboard");
});

async function getData(endpoint) {
  console.log('HEY! Fetching user data...')
  const response = await fetch("https://api.spotify.com/v1" + endpoint, {
    method: "get",
    headers: {
      Authorization: "Bearer " + global.access_token,
    },
  });

  const data = await response.json();
  return data;
}

app.get("/dashboard", async (req, res) => {
    if (USER_INFO.length == 0) {
        console.log('DASHBOARD: A NEW USER LOGIN! Fetching user data from Spotify...')
        try {
            // FIRST, get EVERYTHING
            USER_INFO = await getData("/me");
            //console.log('GOT USER INFO: ' + JSON.stringify(USER_INFO))
            
            const topTracks = await getData("/me/top/tracks?limit=50");
            //console.log('GOT TOP TRACKS: ' + JSON.stringify(topTracks))

            const recentlyPlayed = await getData("/me/player/recently-played?limit=50");
            //console.log('GOT RECENT PLAYED: ' + JSON.stringify(recentlyPlayed))

            // Creating sets for quick lookup
            const topTracksIds = new Set(topTracks.items.map(track => track.id));
            const recentlyPlayedIds = new Set(recentlyPlayed.items.map(item => item.track.id));

            const receivedPlaylists = await getData("/me/playlists?limit=50");
            //console.log('PLAYLISTS: ' + JSON.stringify(playlists.items))

            for (const playlist of receivedPlaylists.items) {
                let ownerID = playlist.owner.id
                console.log('INDIV PLAYLIST OWNDER ID: ' + ownerID)

                // Make sure we only get user's own playlists, no follows
                if (ownerID == USER_INFO.id) {
                    USER_PLAYLISTS.push(playlist)
                
                    const playlistTracks = await getData(`/playlists/${playlist.id}/tracks`); 

                    // EDGE CASE! 🚨 (Sometimes, malformed playlist fetched)
                    if (!playlistTracks || !playlistTracks.items) 
                        continue;
                    
                    for (const item of playlistTracks.items) {
                        // EDGE CASE! 🚨 (e.g. local files)
                        if (!item || !item.track || item.is_local) {
                            console.log('EDGE CASE DETECTED, SKIPPING TRACK');
                            continue;
                        }
                        
                        const track = item.track
                        
                        // Check if the track is neither in the top tracks nor in the recently played tracks
                        if (!topTracksIds.has(track.id) && !recentlyPlayedIds.has(track.id)) {
                            console.log('Added unique track!')
                            // Add to the map
                            REWRAPPED_TRACKS.set(track.id, {
                                name: track.name,
                                preview_url: track.preview_url,
                                artists: track.artists,
                                album_cover_url: track.album.images[0].url,
                                playlist_id: playlist.id,
                                album_uri: track.album.uri,
                                album_name: track.album.name,
                                uri: track.uri,
                            });
                        }
                    }
                }
            }

            console.log(`Unique Tracks Count: ${REWRAPPED_TRACKS.size}`);

            res.render("dashboard", {
                user: USER_INFO,
                playlists: USER_PLAYLISTS
            }); 
  
        } catch (error) {
            console.error('Failed to load data from Spotify', error);
            res.status(500).send('Failed to load data');
        }
    } else {
        console.log('DASHBOARD: Back button prolly was pressed. No need to collect data.')

        res.render("dashboard", {
            user: USER_INFO,
            playlists: USER_PLAYLISTS
        }); 
    }
});

app.get("/playlist", async (req, res) => {
  console.log('Fetching a playlist!')

  const playlist_id = req.query.id;
  const playlist = await getData("/playlists/" + playlist_id);

  // Get all tracks from UNIQUE_SONGS that are in this playlist
  const tracksInPlaylist = Array.from(REWRAPPED_TRACKS.entries()).filter(([trackId, trackObject]) => trackObject.playlist_id === playlist_id);

  // Extract just the track IDs from the filtered array
  const trackIds = tracksInPlaylist.map(([trackId, pId]) => trackId);

  // Shuffle the track IDs and slice to get up to 10 random tracks
  const randomTrackIds = trackIds.sort(() => 0.5 - Math.random()).slice(0, Math.min(10, trackIds.length));

  // Fetch track details
  const tracksToRender = [];
  for (const trackId of randomTrackIds) {
    const trackData = REWRAPPED_TRACKS.get(trackId);
    if (trackData) { 
        tracksToRender.push(trackData);
    }
  }

  PLAYLIST_SELECTED = tracksToRender

  res.render("playlist", { 
    playlist: playlist, 
    tracks: tracksToRender,
    });
});

app.get("/library", async (req, res) => {
  console.log("LOADING LIBRARY");

  const allTrackIds = Array.from(REWRAPPED_TRACKS.keys());

  // Just choose any 10!
  const selectedTrackIds = allTrackIds.sort(() => 0.5 - Math.random()).slice(0, 10);

  // Fetch full track deets...
  const tracksToRender = [];
  for (const trackId of selectedTrackIds) {
    const trackData = REWRAPPED_TRACKS.get(trackId);
    if (trackData) { 
        tracksToRender.push(trackData);
    }
  }

  
  PLAYLIST_SELECTED = tracksToRender;
  
  console.log('Rendering library now!');

  res.render("library", { 
    tracks: tracksToRender });
});

app.get('/createplaylist', async (req, res) => {
    const userId = USER_INFO.id;  // Assuming user's ID is accessible from the session
    const accessToken = global.access_token;  // Access token should also be securely managed per user session
    let tracks = PLAYLIST_SELECTED

    try {
        // Create the playlist on Spotify
        const playlistDetails = {
            name: `${req.query.playlistname} - (Re)Wrapped!`,
            description: 'Created with care from Stanford University.',
            public: true  // or adjust based on your requirement
        };

        const createResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(playlistDetails)
        });

        const playlistData = await createResponse.json();
        if (!createResponse.ok) throw new Error('Failed to create playlist');

        // Add tracks to newly created playlist
        if (tracks && tracks.length > 0) {
            const trackUris = tracks.map(track => track.uri);
            const addTracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ uris: trackUris })
            });

            if (!addTracksResponse.ok) {
                const errorData = await addTracksResponse.json();
                throw new Error('Failed to add tracks: ' + errorData.error.message);
            }
        }

        // Done!
        res.redirect(`/playlistcreated?playlistid=${playlistData.id}`);
    } catch (error) {
        console.error('Error in creating playlist:', error);
        res.status(500).send('Failed to create playlist: ' + error.message);
        res.redirect('/dashboard');
    }
});

app.get('/playlistcreated', async (req, res) => {
  const newPlaylist = await getData("/playlists/" + req.query.playlistid);
  if (newPlaylist) {
    res.render("playlistcreated", { playlist: newPlaylist });
  } else {
    console.error('Error in displaying newly created playlist:', error);
  }
});

////////////////////////////////////////////////////////

let listener = app.listen(process.env.PORT || 3000, function () {
  console.log(
    "Your app is listening on http://localhost:" + listener.address().port
  );
});