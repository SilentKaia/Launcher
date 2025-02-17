import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
} from "@loopback/testlab";
import { ConfigService } from "@/main/services/config.service";
import { GraphicsService } from "@/main/services/graphics.service";
import mockFs from "mock-fs";
import { FriendlyDirectoryMap } from "@/modpack-metadata";
import { USER_PREFERENCE_KEYS } from "@/shared/enums/userPreferenceKeys";
import { ProfileService } from "@/main/services/profile.service";
import fs from "fs";

describe("Graphics service", () => {
  let mockConfigService: StubbedInstanceWithSinonAccessor<ConfigService>;
  let mockProfileService: StubbedInstanceWithSinonAccessor<ProfileService>;
  let graphicsService: GraphicsService;

  beforeEach(() => {
    mockConfigService = createStubInstance(ConfigService);
    mockProfileService = createStubInstance(ProfileService);
    graphicsService = new GraphicsService(
      mockConfigService,
      mockProfileService
    );
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("Validating graphics", () => {
    beforeEach(() => {
      const mockLauncherDirectory = "mock/directory";
      mockConfigService.stubs.launcherDirectory.returns(mockLauncherDirectory);

      mockFs({
        [`${mockLauncherDirectory}/namesGraphics.json`]: JSON.stringify([
          {
            real: "mock-real-name",
            friendly: "mock friendly name",
          },
        ] as FriendlyDirectoryMap[]),
        [`${mockLauncherDirectory}/Graphics Presets/unmapped`]: {},
      });
    });

    it("should return if graphics are in the list", async () => {
      expect(
        await graphicsService.isInGraphicsList("mock-real-name")
      ).to.be.true();
      expect(
        await graphicsService.isInGraphicsList("not-in-list")
      ).to.be.false();
    });

    it("should check if graphics are valid", async () => {
      expect(await graphicsService.isValid("mock-real-name")).to.be.true();
      expect(await graphicsService.isValid("doesn't exist")).to.be.false();
    });
  });

  it("should return the default preference as the first one", async () => {
    const mockLauncherDirectory = "mock/directory";
    mockConfigService.stubs.launcherDirectory.returns(mockLauncherDirectory);

    mockFs({
      [`${mockLauncherDirectory}/namesGraphics.json`]: JSON.stringify([
        {
          real: "mock-real-name",
          friendly: "mock friendly name",
        },
      ] as FriendlyDirectoryMap[]),
      [`${mockLauncherDirectory}/Graphics Presets/unmapped`]: {},
    });

    expect(await graphicsService.getDefaultPreference()).to.eql(
      "mock-real-name"
    );
  });

  it("should get all graphics presets", async () => {
    const mockLauncherDirectory = "mock/directory";
    mockConfigService.stubs.launcherDirectory.returns(mockLauncherDirectory);

    mockFs({
      [`${mockLauncherDirectory}/namesGraphics.json`]: JSON.stringify([
        {
          real: "mock-real-name",
          friendly: "mock friendly name",
        },
      ] as FriendlyDirectoryMap[]),
      [`${mockLauncherDirectory}/Graphics Presets/unmapped`]: {},
    });

    const graphics = await graphicsService.getGraphics();
    const expected: FriendlyDirectoryMap[] = [
      {
        real: "mock-real-name",
        friendly: "mock friendly name",
      },
      {
        real: "unmapped",
        friendly: "unmapped",
      },
    ];

    expect(graphics).to.eql(expected);
  });

  it("should get the graphics preference", () => {
    mockConfigService.stubs.getPreference
      .withArgs(USER_PREFERENCE_KEYS.GRAPHICS)
      .returns("mock-graphics-preference");
    expect(graphicsService.getGraphicsPreference()).to.eql(
      "mock-graphics-preference"
    );
  });

  it("should set the graphics preference", () => {
    graphicsService.setGraphicsPreference("mock-preference");
    sinon.assert.calledWith(
      mockConfigService.stubs.setPreference,
      USER_PREFERENCE_KEYS.GRAPHICS,
      "mock-preference"
    );
  });

  describe("Setting graphics", () => {
    let mockProfileDirectory: string;

    beforeEach(() => {
      const mockLauncherDirectory = "mock/launcher/directory";
      const mockModpackDirectory = "mock/modpack/directory";
      mockProfileDirectory = `${mockModpackDirectory}/profiles`;

      mockConfigService.stubs.launcherDirectory.returns(mockLauncherDirectory);
      mockConfigService.stubs.modDirectory.returns(mockModpackDirectory);
      mockProfileService.stubs.getProfileDirectories.resolves([
        `${mockProfileDirectory}/profile-1`,
        `${mockProfileDirectory}/profile-2`,
      ]);

      mockFs({
        [`${mockLauncherDirectory}/namesGraphics.json`]: JSON.stringify([
          {
            real: "low-real-name",
            friendly: "Low",
          },
        ] as FriendlyDirectoryMap[]),
        [`${mockLauncherDirectory}/Graphics Presets/low-real-name`]: {
          "mock-low-setting.json": "mock content",
          "mock-low-setting-2.json": "mock content",
        },
        [`${mockLauncherDirectory}/Graphics Presets/ultra`]: {
          "mock-ultra-setting.json": "mock content",
          "mock-ultra-setting-2.json": "mock content",
        },
        [`${mockProfileDirectory}/profile-1`]: {},
        [`${mockProfileDirectory}/profile-2`]: {},
      });
    });

    it("should set the graphics preference", async () => {
      await graphicsService.setGraphics("low-real-name");
      sinon.assert.calledWith(
        mockConfigService.stubs.setPreference,
        USER_PREFERENCE_KEYS.GRAPHICS,
        "low-real-name"
      );
    });

    it("should move the graphics files to the profiles", async () => {
      await graphicsService.setGraphics("ultra");

      expect(
        (await fs.promises.readdir(`${mockProfileDirectory}/profile-1`)).sort()
      ).to.eql(["mock-ultra-setting.json", "mock-ultra-setting-2.json"].sort());

      expect(
        (await fs.promises.readdir(`${mockProfileDirectory}/profile-2`)).sort()
      ).to.eql(["mock-ultra-setting.json", "mock-ultra-setting-2.json"].sort());
    });
  });

  it("should backup original graphics if they don't exist", async () => {
    const mockBackupDirectory = "mock/backup/directory";
    const mockLauncherDirectory = "mock/mod/directory";
    const graphicsBackup = `${mockBackupDirectory}/graphics`;
    const graphicsPresets = `${mockLauncherDirectory}/Graphics Presets`;

    mockConfigService.stubs.backupDirectory.returns(mockBackupDirectory);
    mockConfigService.stubs.launcherDirectory.returns(mockLauncherDirectory);

    mockFs({
      [graphicsPresets]: {
        "mock-graphics-low": {},
        "mock-graphics-medium": {},
        "mock-graphics-high": {},
      },
    });

    await graphicsService.backupOriginalGraphics();

    expect((await fs.promises.readdir(graphicsBackup)).sort()).to.eql([
      "mock-graphics-high",
      "mock-graphics-low",
      "mock-graphics-medium",
    ]);
  });

  describe("Restoring backup", () => {
    let mockBackupDirectory: string;
    let mockLauncherDirectory: string;
    let mockModpackDirectory: string;
    let mockGraphicsBackup: string;
    let mockGraphicsPresets: string;
    let mockProfiles: string;

    beforeEach(() => {
      mockBackupDirectory = "mock/backup/directory";
      mockLauncherDirectory = "mock/launcher/directory";
      mockModpackDirectory = "mock/modpack/directory";
      mockGraphicsBackup = `${mockBackupDirectory}/graphics`;
      mockGraphicsPresets = `${mockLauncherDirectory}/Graphics Presets`;
      mockProfiles = `${mockModpackDirectory}/profiles`;

      mockConfigService.stubs.backupDirectory.returns(mockBackupDirectory);
      mockConfigService.stubs.launcherDirectory.returns(mockLauncherDirectory);
      mockProfileService.stubs.getProfileDirectories.resolves([
        `${mockProfiles}/mock-profile-low`,
      ]);
      mockConfigService.stubs.getPreference
        .withArgs(USER_PREFERENCE_KEYS.GRAPHICS)
        .returns("mock-preference");

      mockFs({
        [mockGraphicsBackup]: {
          "mock-preference": {
            "mockfile.json": "original-content",
          },
        },
        [mockGraphicsPresets]: {
          "mock-preference": { "mockfile.json": "edited content" },
        },
        [mockProfiles]: {
          "mock-profile-low": {
            "mockfile.json": "edited content",
          },
        },
      });
    });

    it("should restore the backup", async () => {
      await graphicsService.restoreGraphics();

      expect(
        await fs.promises.readFile(
          `${mockGraphicsPresets}/mock-preference/mockfile.json`,
          "utf-8"
        )
      ).to.eql("original-content");
    });

    it("should update the profiles with graphics", async () => {
      await graphicsService.restoreGraphics();

      expect(
        await fs.promises.readFile(
          `${mockProfiles}/mock-profile-low/mockfile.json`,
          "utf-8"
        )
      ).to.eql("original-content");
    });

    it("should not restore the backup if it exists", async () => {
      mockFs({
        [mockGraphicsBackup]: {},
        [mockGraphicsPresets]: {
          "mock-preference": { "mockfile.json": "edited content" },
        },
        [mockProfiles]: {
          "mock-profile-low": {
            "mockfile.json": "edited content",
          },
        },
      });

      await graphicsService.backupOriginalGraphics();

      expect(await fs.promises.readdir(mockGraphicsBackup)).to.eql([]);
    });
  });

  it("should extract graphics files from a list of files", async () => {
    const files = [
      "/mock/file/path/Skyrim.ini",
      "/mock/file/path/SkyrimPrefs.ini",
      "/mock/file/path/SkyrimCustom.ini",
      "/mock/file/path/another.ini",
    ];
    expect(graphicsService.extractGraphicsFiles(files)).to.eql([
      "/mock/file/path/Skyrim.ini",
      "/mock/file/path/SkyrimPrefs.ini",
      "/mock/file/path/SkyrimCustom.ini",
    ]);
  });

  it("should return if the graphics presets exist", async () => {
    const graphicsPath = "mock/path/graphics";
    mockConfigService.stubs.launcherDirectory.returns(graphicsPath);
    expect(await graphicsService.graphicsExist()).to.eql(false);
    mockFs({
      [`${graphicsPath}/Graphics Presets`]: {},
    });
    expect(await graphicsService.graphicsExist()).to.eql(true);
  });
});
