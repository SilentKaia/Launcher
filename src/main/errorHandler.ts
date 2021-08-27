import { app, dialog } from "electron";
import { logger } from "@/main/logger";

export function fatalError(message: string, err: string | Error) {
  logger.error(`${message}. ${err}`);

  dialog.showMessageBoxSync({
    type: "error",
    title: "A fatal error occurred!",
    message: `
    ${message}
    ${err}
    `,
  });

  app.quit();
}
