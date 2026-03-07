import { nanoid } from "nanoid";

export const generateId = {
  project: (): string => `fs_proj_${nanoid()}`,
  apiKey: (): string => `fs_key_${nanoid()}`,
  seller: (): string => `fs_sel_${nanoid()}`,
  order: (): string => `fs_ord_${nanoid()}`,
  payout: (): string => `fs_pay_${nanoid()}`,
  dispute: (): string => `fs_dis_${nanoid()}`,
  webhookReg: (): string => `fs_whr_${nanoid()}`,
  webhookLog: (): string => `fs_whl_${nanoid()}`,
  liveApiKey: (): string => `fs_live_key_${nanoid(21)}`,
};
