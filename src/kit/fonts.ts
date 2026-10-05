// Font registry for code mode. A scene declares `export const fonts = { 'Unbounded': ['700'], 'Onest': ['400', '600'] }`;
// only those families/weights are fetched, and the frame waits until they are registered (text measurement needs it).
import { loadFont as fUnbounded, getInfo as gUnbounded } from '@remotion/google-fonts/Unbounded';
import { loadFont as fOnest, getInfo as gOnest } from '@remotion/google-fonts/Onest';
import { loadFont as fAzeretMono, getInfo as gAzeretMono } from '@remotion/google-fonts/AzeretMono';
import { loadFont as fSora, getInfo as gSora } from '@remotion/google-fonts/Sora';
import { loadFont as fInter, getInfo as gInter } from '@remotion/google-fonts/Inter';
import { loadFont as fInterTight, getInfo as gInterTight } from '@remotion/google-fonts/InterTight';
import { loadFont as fJetBrainsMono, getInfo as gJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as fBricolageGrotesque, getInfo as gBricolageGrotesque } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as fGeist, getInfo as gGeist } from '@remotion/google-fonts/Geist';
import { loadFont as fGeistMono, getInfo as gGeistMono } from '@remotion/google-fonts/GeistMono';
import { loadFont as fSyne, getInfo as gSyne } from '@remotion/google-fonts/Syne';
import { loadFont as fHankenGrotesk, getInfo as gHankenGrotesk } from '@remotion/google-fonts/HankenGrotesk';
import { loadFont as fFragmentMono, getInfo as gFragmentMono } from '@remotion/google-fonts/FragmentMono';
import { loadFont as fSpaceGrotesk, getInfo as gSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as fSpaceMono, getInfo as gSpaceMono } from '@remotion/google-fonts/SpaceMono';
import { loadFont as fManrope, getInfo as gManrope } from '@remotion/google-fonts/Manrope';
import { loadFont as fIBMPlexMono, getInfo as gIBMPlexMono } from '@remotion/google-fonts/IBMPlexMono';
import { loadFont as fArchivoBlack, getInfo as gArchivoBlack } from '@remotion/google-fonts/ArchivoBlack';
import { loadFont as fArchivo, getInfo as gArchivo } from '@remotion/google-fonts/Archivo';
import { loadFont as fDMMono, getInfo as gDMMono } from '@remotion/google-fonts/DMMono';
import { loadFont as fDMSans, getInfo as gDMSans } from '@remotion/google-fonts/DMSans';
import { loadFont as fInstrumentSerif, getInfo as gInstrumentSerif } from '@remotion/google-fonts/InstrumentSerif';
import { loadFont as fInstrumentSans, getInfo as gInstrumentSans } from '@remotion/google-fonts/InstrumentSans';
import { loadFont as fFraunces, getInfo as gFraunces } from '@remotion/google-fonts/Fraunces';
import { loadFont as fPlayfairDisplay, getInfo as gPlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as fNewsreader, getInfo as gNewsreader } from '@remotion/google-fonts/Newsreader';
import { loadFont as fAnton, getInfo as gAnton } from '@remotion/google-fonts/Anton';
import { loadFont as fBebasNeue, getInfo as gBebasNeue } from '@remotion/google-fonts/BebasNeue';
import { loadFont as fOswald, getInfo as gOswald } from '@remotion/google-fonts/Oswald';
import { loadFont as fCaveat, getInfo as gCaveat } from '@remotion/google-fonts/Caveat';
import { loadFont as fPermanentMarker, getInfo as gPermanentMarker } from '@remotion/google-fonts/PermanentMarker';
import { loadFont as fShadowsIntoLight, getInfo as gShadowsIntoLight } from '@remotion/google-fonts/ShadowsIntoLight';
import { loadFont as fFredoka, getInfo as gFredoka } from '@remotion/google-fonts/Fredoka';
import { loadFont as fBaloo2, getInfo as gBaloo2 } from '@remotion/google-fonts/Baloo2';
import { loadFont as fSniglet, getInfo as gSniglet } from '@remotion/google-fonts/Sniglet';
import { loadFont as fMontserrat, getInfo as gMontserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as fPoppins, getInfo as gPoppins } from '@remotion/google-fonts/Poppins';
import { loadFont as fPlusJakartaSans, getInfo as gPlusJakartaSans } from '@remotion/google-fonts/PlusJakartaSans';
import { loadFont as fOutfit, getInfo as gOutfit } from '@remotion/google-fonts/Outfit';
import { loadFont as fLexend, getInfo as gLexend } from '@remotion/google-fonts/Lexend';
import { loadFont as fFigtree, getInfo as gFigtree } from '@remotion/google-fonts/Figtree';
import { loadFont as fUrbanist, getInfo as gUrbanist } from '@remotion/google-fonts/Urbanist';
import { loadFont as fRubikMonoOne, getInfo as gRubikMonoOne } from '@remotion/google-fonts/RubikMonoOne';
import { loadFont as fBungee, getInfo as gBungee } from '@remotion/google-fonts/Bungee';
import { loadFont as fRighteous, getInfo as gRighteous } from '@remotion/google-fonts/Righteous';

type Loader = (style: 'normal', opts: { weights: string[]; subsets: string[]; ignoreTooManyRequestsWarning?: boolean }) => { fontFamily: string; waitUntilDone: () => Promise<void> };

type Info = () => { fonts: { normal?: Record<string, unknown> } };

export const FONT_REGISTRY: Record<string, { load: Loader; info: Info }> = {
  'Unbounded': { load: fUnbounded as Loader, info: gUnbounded as Info },
  'Onest': { load: fOnest as Loader, info: gOnest as Info },
  'Azeret Mono': { load: fAzeretMono as Loader, info: gAzeretMono as Info },
  'Sora': { load: fSora as Loader, info: gSora as Info },
  'Inter': { load: fInter as Loader, info: gInter as Info },
  'Inter Tight': { load: fInterTight as Loader, info: gInterTight as Info },
  'JetBrains Mono': { load: fJetBrainsMono as Loader, info: gJetBrainsMono as Info },
  'Bricolage Grotesque': { load: fBricolageGrotesque as Loader, info: gBricolageGrotesque as Info },
  'Geist': { load: fGeist as Loader, info: gGeist as Info },
  'Geist Mono': { load: fGeistMono as Loader, info: gGeistMono as Info },
  'Syne': { load: fSyne as Loader, info: gSyne as Info },
  'Hanken Grotesk': { load: fHankenGrotesk as Loader, info: gHankenGrotesk as Info },
  'Fragment Mono': { load: fFragmentMono as Loader, info: gFragmentMono as Info },
  'Space Grotesk': { load: fSpaceGrotesk as Loader, info: gSpaceGrotesk as Info },
  'Space Mono': { load: fSpaceMono as Loader, info: gSpaceMono as Info },
  'Manrope': { load: fManrope as Loader, info: gManrope as Info },
  'IBM Plex Mono': { load: fIBMPlexMono as Loader, info: gIBMPlexMono as Info },
  'Archivo Black': { load: fArchivoBlack as Loader, info: gArchivoBlack as Info },
  'Archivo': { load: fArchivo as Loader, info: gArchivo as Info },
  'DM Mono': { load: fDMMono as Loader, info: gDMMono as Info },
  'DM Sans': { load: fDMSans as Loader, info: gDMSans as Info },
  'Instrument Serif': { load: fInstrumentSerif as Loader, info: gInstrumentSerif as Info },
  'Instrument Sans': { load: fInstrumentSans as Loader, info: gInstrumentSans as Info },
  'Fraunces': { load: fFraunces as Loader, info: gFraunces as Info },
  'Playfair Display': { load: fPlayfairDisplay as Loader, info: gPlayfairDisplay as Info },
  'Newsreader': { load: fNewsreader as Loader, info: gNewsreader as Info },
  'Anton': { load: fAnton as Loader, info: gAnton as Info },
  'Bebas Neue': { load: fBebasNeue as Loader, info: gBebasNeue as Info },
  'Oswald': { load: fOswald as Loader, info: gOswald as Info },
  'Caveat': { load: fCaveat as Loader, info: gCaveat as Info },
  'Permanent Marker': { load: fPermanentMarker as Loader, info: gPermanentMarker as Info },
  'Shadows Into Light': { load: fShadowsIntoLight as Loader, info: gShadowsIntoLight as Info },
  'Fredoka': { load: fFredoka as Loader, info: gFredoka as Info },
  'Baloo Two': { load: fBaloo2 as Loader, info: gBaloo2 as Info },
  'Sniglet': { load: fSniglet as Loader, info: gSniglet as Info },
  'Montserrat': { load: fMontserrat as Loader, info: gMontserrat as Info },
  'Poppins': { load: fPoppins as Loader, info: gPoppins as Info },
  'Plus Jakarta Sans': { load: fPlusJakartaSans as Loader, info: gPlusJakartaSans as Info },
  'Outfit': { load: fOutfit as Loader, info: gOutfit as Info },
  'Lexend': { load: fLexend as Loader, info: gLexend as Info },
  'Figtree': { load: fFigtree as Loader, info: gFigtree as Info },
  'Urbanist': { load: fUrbanist as Loader, info: gUrbanist as Info },
  'Rubik Mono One': { load: fRubikMonoOne as Loader, info: gRubikMonoOne as Info },
  'Bungee': { load: fBungee as Loader, info: gBungee as Info },
  'Righteous': { load: fRighteous as Loader, info: gRighteous as Info },
};
export const FONT_NAMES = Object.keys(FONT_REGISTRY);

export type FontRequest = Record<string, string[]>;

const started = new Map<string, Promise<void>>();
/** start loading a request; resolves when every requested face is in document.fonts */
export const loadFonts = (req: FontRequest): Promise<void> => {
  const key = JSON.stringify(req);
  if (!started.has(key)) {
    const waits: Promise<void>[] = [];
    for (const [name, weights] of Object.entries(req)) {
      const entry = FONT_REGISTRY[name];
      if (!entry) {
        console.warn(`[ROS-QA] font "${name}" is not in the registry — falling back to the browser default`);
        continue;
      }
      // keep only weights the family has; otherwise take the closest one
      const have = Object.keys(entry.info().fonts.normal ?? {}).map(Number);
      const ok = weights.map(Number).map((w) => (have.includes(w) ? w : have.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a), have[0])));
      waits.push(entry.load('normal', { weights: [...new Set(ok)].map(String), subsets: ['latin'], ignoreTooManyRequestsWarning: true }).waitUntilDone());
    }
    started.set(key, Promise.all(waits).then(() => document.fonts.ready).then(() => undefined));
  }
  return started.get(key)!;
};
