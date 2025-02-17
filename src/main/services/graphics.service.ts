import { FriendlyDirectoryMap } from "@/modpack-metadata";
import fs from "fs";
import { ConfigService } from "@/main/services/config.service";
import { USER_PREFERENCE_KEYS } from "@/shared/enums/userPreferenceKeys";
import { not as isNotJunk } from "junk";
import { service } from "@loopback/core";
import { ProfileService } from "@/main/services/profile.service";
import path from "path";
import { logger } from "@/main/logger";
import { copy, existsSync } from "fs-extra";

export class GraphicsService {
  constructor(
    @service(ConfigService) private configService: ConfigService,
    @service(ProfileService) private profileService: ProfileService
  ) {}

  graphicsDirectory() {
    return `${this.configService.launcherDirectory()}/Graphics Presets`;
  }

  graphicsMappingFile() {
    return "namesGraphics.json";
  }

  graphicsMappingPath() {
    return `${this.configService.launcherDirectory()}/${this.graphicsMappingFile()}`;
  }

  private graphicsBackupDirectory() {
    return `${this.configService.backupDirectory()}/graphics`;
  }

  async isInGraphicsList(graphics: string) {
    return (
      (await this.getGraphics()).filter(({ real }) => real === graphics)
        .length > 0
    );
  }

  async isValid(graphics: string) {
    return this.isInGraphicsList(graphics);
  }

  async getDefaultPreference() {
    return (await this.getGraphics())[0].real;
  }

  private async getMappedGraphics(): Promise<FriendlyDirectoryMap[]> {
    return JSON.parse(
      await fs.promises.readFile(`${this.graphicsMappingPath()}`, "utf-8")
    );
  }

  private async getUnmappedGraphics(mappedGraphics: FriendlyDirectoryMap[]) {
    return (
      (
        await fs.promises.readdir(this.graphicsDirectory(), {
          withFileTypes: true,
        })
      )
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .filter(isNotJunk)
        .map(
          (preset): FriendlyDirectoryMap => ({ real: preset, friendly: preset })
        )
        // Remove any graphics that have a mapping
        .filter(
          (unmappedSetting) =>
            !mappedGraphics.find(
              (mappedSetting: FriendlyDirectoryMap) =>
                mappedSetting.real === unmappedSetting.real
            )
        )
    );
  }

  async getGraphics(): Promise<FriendlyDirectoryMap[]> {
    const mappedGraphics = await this.getMappedGraphics();
    const unmappedGraphics = await this.getUnmappedGraphics(mappedGraphics);

    return [...mappedGraphics, ...unmappedGraphics];
  }

  /**
   * Return the current graphics preference or the first if it is invalid
   */
  getGraphicsPreference(): string {
    return this.configService.getPreference<string>(
      USER_PREFERENCE_KEYS.GRAPHICS
    );
  }

  async setGraphics(graphics: string) {
    logger.info(`Setting graphics to ${graphics}`);
    this.setGraphicsPreference(graphics);
    await this.updateProfilesWithGraphics(graphics);
  }

  async getGraphicsFilesForPreset(graphics: string) {
    return (
      await fs.promises.readdir(`${this.graphicsDirectory()}/${graphics}`)
    ).map((file) => `${this.graphicsDirectory()}/${graphics}/${file}`);
  }

  async updateProfilesWithGraphics(preset: string) {
    logger.debug("Updating profiles with graphics settings");
    const graphics = await this.getGraphicsFilesForPreset(preset);
    const profiles = await this.profileService.getProfileDirectories();
    return Promise.all(
      profiles.map((profile) =>
        graphics.map(async (file) => {
          logger.debug(`Copying ${file} to ${profile}`);
          await fs.promises.copyFile(file, `${profile}/${path.basename(file)}`);
        })
      )
    );
  }

  setGraphicsPreference(graphics: string) {
    this.configService.setPreference(USER_PREFERENCE_KEYS.GRAPHICS, graphics);
  }

  async backupOriginalGraphics() {
    const backupExists = existsSync(this.graphicsBackupDirectory());
    logger.debug(`Backup for graphics exists: ${backupExists}`);

    if (!backupExists) {
      logger.info("No graphics backup exists. Backing up...");
      await fs.promises.mkdir(this.configService.backupDirectory(), {
        recursive: true,
      });

      await copy(this.graphicsDirectory(), this.graphicsBackupDirectory());
    }
  }

  async graphicsExist() {
    return fs.existsSync(this.graphicsDirectory());
  }

  extractGraphicsFiles(files: string[]) {
    const graphicsFiles = ["Skyrim.ini", "SkyrimCustom.ini", "SkyrimPrefs.ini"];
    return files.filter((file) => graphicsFiles.includes(path.basename(file)));
  }

  async restoreGraphics() {
    logger.info("Restoring graphics settings");
    logger.debug(
      `Copying ${this.graphicsBackupDirectory()} to ${this.graphicsDirectory()}`
    );
    await copy(this.graphicsBackupDirectory(), this.graphicsDirectory(), {
      overwrite: true,
    });
    await this.updateProfilesWithGraphics(this.getGraphicsPreference());
    logger.info("Graphics restored");
  }
}
