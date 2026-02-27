import { CharacterChatType } from "./type";

// 判斷是否為臨時角色
export const isTempCharacter = (char: CharacterChatType) => char.temp_user === true;