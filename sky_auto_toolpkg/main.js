"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
  return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToolPkg = registerToolPkg;
const sky_setup_1 = __importDefault(require("./ui/sky_setup/index.ui.js"));
function registerToolPkg() {
  ToolPkg.registerToolboxUiModule({
    id: "sky_setup",
    runtime: "compose_dsl",
    screen: sky_setup_1.default,
    params: {},
    title: { zh: "光遇坐标配置", en: "Sky Coordinates Setup" }
  });
  return true;
}
exports.registerToolPkg = registerToolPkg;
