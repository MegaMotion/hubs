import { isLocalHubsSceneUrl, isHubsRoomUrl, isLocalHubsAvatarUrl } from "../utils/media-url-utils";
import { guessContentType } from "../utils/media-url-utils";
import { handleExitTo2DInterstitial } from "../utils/vr-interstitial";

/*  // NOPE!!! This was one way to do it, but instead we are relying on strict naming conventions, so we don't
    // need to push another client build just to change the number of rooms available.
var rooms_array = [
  { slug: "m-peachgate", hub_sid: "oefaBKd", copy_rooms: ["SB9RfcE", "p2N4iWX"] },
  { slug: "m-xavanadu", hub_sid: "nb4Xh4a", copy_rooms: ["DT8DngM"] },
  { slug: "m-chelamela", hub_sid: "8kkd9rJ", copy_rooms: ["JmkxLFH"] },
  { slug: "m-jillscrossing", hub_sid: "oZUvVBu", copy_rooms: ["akBtKYg"] },
  { slug: "m-e13th", hub_sid: "kZSgGXo", copy_rooms: ["Yq4hDRV"] },
  { slug: "m-communityvillage", hub_sid: "zWSpT5H", copy_rooms: ["nktgenp"] },
  { slug: "m-upperriver", hub_sid: "kTioiNj", copy_rooms: ["EXXEoHM", "PWmwsHC"] },
  { slug: "m-theritz", hub_sid: "xFKRmiG", copy_rooms: ["7tDAuQU"] },
  { slug: "m-mainstage", hub_sid: "VDcxrbc", copy_rooms: ["zTqh7Ce"] }
];*/

async function getRoomsData() {
  // by https://twitter.com/jamesckane for @paracreative worked on the #ApartPosters show.
  //let endpoint = "/api/v1/media/search?source=rooms&filter=public";
  let endpoint = "https://hubs.ocfintheclouds.net/api/v1/media/search?source=rooms&filter=public";
  let response = await fetch(endpoint);
  let json = await response.json();

  let next_cursor = json.meta.next_cursor;
  while (next_cursor > 0) {
    let new_endpoint = endpoint + "&cursor=" + String(next_cursor);
    response = await fetch(new_endpoint);
    let next_json = await response.json();
    next_json.entries.forEach(room => {
      json.entries.push(room);
    });
    if (next_json.meta.next_cursor === undefined) next_cursor = 0;
    else next_cursor = next_json.meta.next_cursor;
  }
  return json;
}

function compareRooms(a, b) {
  let slugA = String(a.url);
  slugA = slugA.substring(slugA.lastIndexOf("/"), slugA.length);
  let slugB = String(b.url);
  slugB = slugB.substring(slugB.lastIndexOf("/"), slugB.length);
  let comparison = 0;
  if (slugA > slugB) {
    comparison = 1;
  } else if (slugA < slugB) {
    comparison = -1;
  }
  return comparison;
}

AFRAME.registerComponent("open-media-button", {
  schema: {
    onlyOpenLink: { type: "boolean" }
  },
  init() {
    this.label = this.el.querySelector("[text]");

    this.updateSrc = async () => {
      if (!this.targetEl.parentNode) return; // If removed
      const src = (this.src = this.targetEl.components["media-loader"].data.src);
      const visible = src && guessContentType(src) !== "video/vnd.hubs-webrtc";
      const mayChangeScene = this.el.sceneEl.systems.permissions.canOrWillIfCreator("update_hub");

      this.el.object3D.visible = !!visible;

      if (visible) {
        let label = "open link";
        if (!this.data.onlyOpenLink) {
          if (await isLocalHubsAvatarUrl(src)) {
            label = "use avatar";
          } else if ((await isLocalHubsSceneUrl(src)) && mayChangeScene) {
            label = "use scene";
          } else if (await isHubsRoomUrl(src)) {
            label = "go to room";
          }
        }
        this.label.setAttribute("text", "value", label);
      }
    };

    this.onClick = async () => {
      const mayChangeScene = this.el.sceneEl.systems.permissions.canOrWillIfCreator("update_hub");

      const exitImmersive = async () => await handleExitTo2DInterstitial(false, () => {}, true);

      if (this.data.onlyOpenLink) {
        await exitImmersive();
        window.open(this.src);
      } else if (await isLocalHubsAvatarUrl(this.src)) {
        const avatarId = new URL(this.src).pathname.split("/").pop();
        window.APP.store.update({ profile: { avatarId } });
        this.el.sceneEl.emit("avatar_updated");
      } else if ((await isLocalHubsSceneUrl(this.src)) && mayChangeScene) {
        this.el.sceneEl.emit("scene_media_selected", this.src);
      } else if (await isHubsRoomUrl(this.src)) {
        await exitImmersive();

        //window.APP.store.update({ activity: { hasBeenFlagged: false } });

        let currentUrl = location.href;
        console.log("Going to room: " + this.src + "\n from room: " + currentUrl);

        if (currentUrl.indexOf("/m-") > 0) {
          //This means we are in one of our staging rooms, eg m-peachgate.
          //The event rooms do not have the m- prefix, so they are like "/peachgate01" etc.
          location.href = this.src; //If we are already in a staging room, then just follow the link.
        } //NOTE: in the future, ALL staging rooms will have to continue to be named this way.

        //console.log("Has been flagged: " + String(window.APP.store.state.activity.hasBeenFlagged));
        //console.log("Has Scaled: " + String(window.APP.store.state.activity.hasScaled));
        //console.log("Entry Count: " + String(window.APP.store.state.activity.entryCount));

        let URL = this.src;
        let endPos = URL.indexOf("?"); //Find the end of the slug, before the arguments.
        let startPos = URL.indexOf("/m-"); //Make use of the fact that all of our rooms start like "m-peachgate"
        let theSlug = URL.substring(startPos + 3, endPos); //+3 to get past the 'm-'
        console.log("theSlug: " + theSlug);

        let rooms_data = await getRoomsData();
        let rooms = rooms_data.entries;
        console.log("Total room data entries: " + String(rooms.length));
        let bestUrl = "";
        var copyRooms = rooms.filter(function(room) {
          return room.url.indexOf(theSlug) > 0;
        });
        console.log("Room entries for " + theSlug + ": " + String(copyRooms.length));
        if (copyRooms.length > 0) {
          copyRooms.forEach(room => {
            console.log("unsorted rooms: " + room.url);
          });
          copyRooms.sort(compareRooms);
          copyRooms.forEach(room => {
            console.log("sorted rooms: " + room.url);
            let memberCount = room.member_count;
            let lobbyCount = room.lobby_count;
            if (memberCount < room.room_size && bestUrl.length == 0) {
              bestUrl = room.url + "?vr_entry_type=2d_now&waypoint_search_prefix=StageSpawn";
            }
          });
        }

        //console.log("JSON: " + json);
        if (bestUrl.length > 0) {
          location.href = bestUrl;
        } else {
          location.href = this.src;
        }
      } else {
        await exitImmersive();
        window.open(this.src);
      }
    };

    NAF.utils.getNetworkedEntity(this.el).then(networkedEl => {
      this.targetEl = networkedEl;
      this.targetEl.addEventListener("media_resolved", this.updateSrc, { once: true });
      this.updateSrc();
    });
  },

  play() {
    this.el.object3D.addEventListener("interact", this.onClick);
  },

  pause() {
    this.el.object3D.removeEventListener("interact", this.onClick);
  }
});
