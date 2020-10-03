import { isLocalHubsSceneUrl, isHubsRoomUrl, isLocalHubsAvatarUrl } from "../utils/media-url-utils";
import { guessContentType } from "../utils/media-url-utils";
import { handleExitTo2DInterstitial } from "../utils/vr-interstitial";
import { pickBestRoom } from "../vendor/ocf_utils";

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
            const url = new URL(this.src);
            if (url.hash && window.location.pathname === url.pathname) {
              label = "go to";
            } else {
              label = "visit room";
            }
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

        //if (currentUrl.indexOf("/l-") > 0) { //live staging rooms
        if (currentUrl.indexOf("/m-") > 0) {
          //This means we are in one of our staging rooms, eg m-peachgate.
          //The event rooms do not have the m- prefix, so they are like "/peachgate01" etc.
          //let newUrl = this.src;
          //newUrl.replace("/m-", "/l-");
          //console.log("fixed the URL: \n" + newUrl);
          location.href = this.src; //If we are already in a staging room, then just follow the link.
        }

        //console.log("Has been flagged: " + String(window.APP.store.state.activity.hasBeenFlagged));
        //console.log("Has Scaled: " + String(window.APP.store.state.activity.hasScaled));
        //console.log("Entry Count: " + String(window.APP.store.state.activity.entryCount));

        let URL = this.src;
        let endPos = URL.indexOf("?"); //Find the end of the slug, before the arguments.
        let startPos = URL.indexOf("/m-"); //Make use of the fact that all of our rooms start like "m-peachgate"
        let toSlug = URL.substring(startPos + 3, endPos); //+3 to get past the 'm-'
        console.log("toSlug: " + toSlug);
        let prefix_string = "&waypoint_search_prefix=";
        let search_start = URL.indexOf(prefix_string);
        let search_prefix = URL.substring(search_start + prefix_string.length, URL.length);

        let bestUrl = await pickBestRoom(toSlug, search_prefix);
        /*
        let rooms_data = await getRoomsData();
        let rooms = rooms_data.entries;
        let search_prefix = "StageSpawn";
        let room_buffer = 5; //maybe? just to cover people currently on their way in.
        console.log("Total room data entries: " + String(rooms.length));
        let bestUrl = "";
        var copyRooms = rooms.filter(function(room) {
          return room.url.indexOf(theSlug) > 0;
        });
        console.log("Room entries for " + theSlug + ": " + String(copyRooms.length));
        if (copyRooms.length > 0) {
          copyRooms.sort(compareRooms);
          copyRooms.forEach(room => {
            console.log("sorted rooms: " + room.url);
            let memberCount = room.member_count;
            //let lobbyCount = room.lobby_count;
            if (memberCount < room.room_size - room_buffer && bestUrl.length == 0) {
              bestUrl = room.url + "?vr_entry_type=2d_now&waypoint_search_prefix=" + search_prefix;
            }
          });
        }
        */
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
