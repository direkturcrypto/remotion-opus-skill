import type { Widget } from '../spec/schema';
import type { Ctx, WidgetOut } from '../engine/types';
import { agents, lockup } from './agents';
import { code, stat, vision } from './cards';
import { hero } from './hero';
import { price } from './price';
import { bars, chat, checklist, headline } from './text';

export const buildWidget = (w: Widget, ctx: Ctx): WidgetOut => {
  switch (w.type) {
    case 'hero':
      return hero(w, ctx);
    case 'stat':
      return stat(w, ctx);
    case 'vision':
      return vision(w, ctx);
    case 'code':
      return code(w, ctx);
    case 'price':
      return price(w, ctx);
    case 'agents':
      return agents(w, ctx);
    case 'lockup':
      return lockup(w, ctx);
    case 'headline':
      return headline(w, ctx);
    case 'chat':
      return chat(w, ctx);
    case 'bars':
      return bars(w, ctx);
    case 'checklist':
      return checklist(w, ctx);
  }
};
