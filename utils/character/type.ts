import { UniformDetail } from "@/components/page/game/guessing-dick/step1"
import { Gender, BloodType, PersonalityType } from "."

export type CharacterType = {
  id: string
  userId: string
  image: string
  name: string
  tag?: string
  gender: Gender
  birthday: string
  zodiac: string
  bloodType: BloodType
  personality?: string
  systemPrompt: string
  englishName?: string
  mbti: PersonalityType
  birthplace?: string
  education?: string
  appearance?: string
  detail?: string
  uniformDetail?: UniformDetail | null
}

export const initialCharacter: CharacterType = {
  id: "",
  userId: "",
  image: "",
  name: "",
  tag: "",
  gender: Gender.MALE,
  birthday: "",
  zodiac: "",
  bloodType: BloodType.A,
  personality: "",
  systemPrompt: "",
  englishName: "",
  mbti: PersonalityType.INTJ,
  birthplace: "",
  education: "",
  appearance: "",
  detail: "",
  uniformDetail: null,
};
