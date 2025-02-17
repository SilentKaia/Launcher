<template>
  <AppPageContent width="large">
    <div class="c-settings l-column">
      <div class="c-settings__directories l-column">
        <ModDirectory />
      </div>

      <div class="l-row c-settings__actions">
        <div class="c-settings__label">Mod Organizer 2</div>
        <div class="c-settings__action">
          <BaseButton type="primary" @click="launchMO2">Launch</BaseButton>
        </div>
      </div>
      <div class="l-row c-settings__actions">
        <div class="c-settings__label">Application logs</div>
        <div class="c-settings__action c-settings__multi-buttons">
          <BaseButton
            class="c-settings__multi-button"
            type="default"
            size="grow"
            @click="openLogPath"
          >
            Open
          </BaseButton>
          <BaseButton
            class="c-settings__multi-button"
            type="default"
            size="grow"
            @click="clearLogs"
          >
            Clear
          </BaseButton>
        </div>
      </div>
      <div class="l-row c-settings__actions">
        <div class="c-settings__label">Skyrim crash logs</div>
        <div class="c-settings__action">
          <BaseButton type="default" @click="openCrashLogPath">
            Open
          </BaseButton>
        </div>
      </div>
      <div class="l-row c-settings__actions">
        <div class="c-settings__label">Restore ENB presets</div>
        <div class="c-settings__action">
          <BaseButton type="warning" @click="restoreENBPresets">
            Restore
          </BaseButton>
        </div>
      </div>
      <div class="l-row c-settings__actions">
        <div class="c-settings__label">Restore MO2 profiles</div>
        <div class="c-settings__action">
          <BaseButton type="warning" @click="restoreProfiles">
            Restore
          </BaseButton>
        </div>
      </div>
      <div class="l-row c-settings__actions">
        <div class="c-settings__label">Restore graphics presets</div>
        <div class="c-settings__action">
          <BaseButton type="warning" @click="restoreGraphics">
            Restore
          </BaseButton>
        </div>
      </div>
      <div class="l-row c-settings__actions">
        <div class="c-settings__label">Show hidden profiles</div>
        <div class="c-settings__action c-settings__action--toggle">
          <Toggle @click="setShowHiddenProfiles" v-model="showHiddenProfiles" />
        </div>
      </div>
    </div>
  </AppPageContent>
</template>

<script lang="ts">
import { Options, Vue } from "vue-class-component";
import AppPage from "@/renderer/components/AppPage.vue";
import AppPageContent from "@/renderer/components/AppPageContent.vue";
import BaseButton from "@/renderer/components/BaseButton.vue";
import ModDirectory from "@/renderer/components/ModDirectory.vue";
import {
  injectStrict,
  SERVICE_BINDINGS,
} from "@/renderer/services/service-container";
import { ENB_EVENTS } from "@/main/controllers/enb/enb.events";
import { MOD_ORGANIZER_EVENTS } from "@/main/controllers/modOrganizer/modOrganizer.events";
import { SYSTEM_EVENTS } from "@/main/controllers/system/system.events";
import {
  DISABLE_LOADING_EVENT,
  ENABLE_LOADING_EVENT,
} from "@/renderer/services/event.service";
import { PROFILE_EVENTS } from "@/main/controllers/profile/profile.events";
import { GRAPHICS_EVENTS } from "@/main/controllers/graphics/graphics.events";
import Toggle from "@vueform/toggle/src/Toggle";

@Options({
  components: {
    ModDirectory,
    AppPage,
    AppPageContent,
    BaseButton,
    Toggle,
  },
})
export default class Settings extends Vue {
  private eventService = injectStrict(SERVICE_BINDINGS.EVENT_SERVICE);
  private messageService = injectStrict(SERVICE_BINDINGS.MESSAGE_SERVICE);
  private ipcService = injectStrict(SERVICE_BINDINGS.IPC_SERVICE);
  private showHiddenProfiles = false;

  async created() {
    this.showHiddenProfiles = await this.ipcService.invoke(
      PROFILE_EVENTS.GET_SHOW_HIDDEN_PROFILES
    );
  }

  async launchMO2() {
    this.eventService.emit(ENABLE_LOADING_EVENT);
    try {
      await this.ipcService.invoke(MOD_ORGANIZER_EVENTS.LAUNCH_MO2);
    } catch (error) {
      await this.messageService.error({
        title: "Failed to launch MO2",
        error: (error as Error).message,
      });
    }
    this.eventService.emit(DISABLE_LOADING_EVENT);
  }

  async restoreENBPresets() {
    this.eventService.emit(ENABLE_LOADING_EVENT);

    const { response } = await this.messageService.confirmation(
      "Restoring ENB presets will reset any changes you have made to any ENBs. This cannot be undone. Are you sure?",
      ["Cancel", "Restore ENB presets"]
    );
    if (response === 1) {
      try {
        await this.ipcService.invoke(ENB_EVENTS.RESTORE_ENB_PRESETS);
      } catch (error) {
        await this.messageService.error({
          title: "Error restoring ENB files",
          error: (error as Error).message,
        });
      }
    }

    this.eventService.emit(DISABLE_LOADING_EVENT);
  }

  async restoreProfiles() {
    this.eventService.emit(ENABLE_LOADING_EVENT);

    const { response } = await this.messageService.confirmation(
      "Restoring MO2 profiles will reset any changes you have made to any profiles. This cannot be undone. Are you sure?",
      ["Cancel", "Restore MO2 profiles"]
    );

    if (response === 1) {
      try {
        await this.ipcService.invoke(PROFILE_EVENTS.RESTORE_PROFILES);
      } catch (error) {
        await this.messageService.error({
          title: "Error restoring MO2 profiles",
          error: (error as Error).message,
        });
      }
    }

    this.eventService.emit(DISABLE_LOADING_EVENT);
  }

  async restoreGraphics() {
    this.eventService.emit(ENABLE_LOADING_EVENT);

    const { response } = await this.messageService.confirmation(
      "Restoring graphics presets will reset any changes you have made to any presets. This cannot be undone. Are you sure?",
      ["Cancel", "Restore graphics presets"]
    );

    if (response === 1) {
      try {
        await this.ipcService.invoke(GRAPHICS_EVENTS.RESTORE_GRAPHICS);
      } catch (error) {
        await this.messageService.error({
          title: "Error restoring graphics presets",
          error: (error as Error).message,
        });
      }
    }

    this.eventService.emit(DISABLE_LOADING_EVENT);
  }

  async openLogPath() {
    await this.ipcService.invoke(SYSTEM_EVENTS.OPEN_APPLICATION_LOGS);
  }

  async clearLogs() {
    // clear logs (main & renderer) via event
    await this.ipcService.invoke(SYSTEM_EVENTS.CLEAR_APP_LOGS);
  }

  async openCrashLogPath() {
    await this.ipcService.invoke(SYSTEM_EVENTS.OPEN_CRASH_LOGS);
  }

  async setShowHiddenProfiles() {
    await this.ipcService.invoke(
      PROFILE_EVENTS.SET_SHOW_HIDDEN_PROFILES,
      this.showHiddenProfiles
    );
  }
}
</script>

<style scoped lang="scss">
@import "~@/assets/scss";

.c-settings {
  line-height: $line-height__body;
}

.c-settings__directories {
  border-bottom: 1px solid $colour-background--light;
  margin-bottom: $size-spacing;
  padding-bottom: $size-spacing;
}

.c-settings__multi-buttons {
  display: flex;

  :last-child {
    margin-right: 0;
  }
}

.c-settings__multi-button {
  margin-right: 5px;
}

.c-settings__actions {
  flex: 1;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-top: $size-spacing;

  width: 50%;
}

.c-settings__action {
  flex: 1;
}

.c-settings__action--toggle {
  display: flex;
  justify-content: center;
}

.c-settings__label {
  margin-right: $size-spacing;
  flex: 1;
}
</style>

<style src="@vueform/toggle/themes/default.css"></style>
