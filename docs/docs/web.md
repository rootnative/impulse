---
id: web
title: Web behaviour
description: What each Impulse intent does on react-native-web, and what has not been checked yet.
---

# Web behaviour

Web is a platform, not a footnote. RNGH's web implementation differs from its
native one, and discovering that per project is the failure mode this page
exists to prevent.

:::note What "verified" means here

A verified row was run in a desktop browser against the example app. Rows
marked **unverified** have not been checked and are not claims.

:::

## Status by intent

| Intent | Activation criteria honoured | Behaviour in a browser |
| --- | --- | --- |
| `useTap` | Yes — verified in RNGH's source | **Works** |
| `useDoubleTap` | Yes — verified in RNGH's source | **Works** |
| `useLongPress` | Yes — verified in RNGH's source | **Works**, with two caveats below |
| `useDrag` | Yes — verified in RNGH's source | **Works** |

All four intents recognize correctly under a mouse on web.

## The cancel path reports on the JS thread

Found during the web pass, and **not a web-specific problem**. It behaves the
same on a device.

Hold a `useLongPress` past `minDuration`, then move the pointer more than
`maxDistance` — 10 points by default — without releasing. The press is
cancelled, and `onLongPressEnd` reports it:

```tsx
const hold = useLongPress({
  onLongPress: () => setPhase('held'),
  onLongPressEnd: (event, { cancelled }) => {
    setPhase(cancelled ? 'cancelled' : 'released')
  },
})
```

Every end callback works this way — `onTap`, `onDoubleTap`, `onLongPressEnd`,
and `onDragEnd`. Each fires on both endings, and `cancelled` says which. See
[the cancel path](/use-long-press#the-cancel-path) for the full contract.

Before this argument existed, a cancel was reported only by `onFinalize`, which
is a worklet — so a screen holding its phase in React state had to write
`'worklet'` plus `scheduleOnRN` by hand. That was the ceremony Impulse exists to
remove, and it is gone.

`onFinalize` is unchanged. It fires for every touch that reached the view,
recognized or not, which is what makes it the right place to undo whatever
`onBegin` set.

## `useLongPress` cancels on travel, against RNGH's own contract

RNGH documents `maxDist` as bounding the wait only — *"if the finger travels
further than the defined distance **and the handler hasn't yet activated**, it
will fail"*. A recognized press should tolerate travel.

Its web implementation does not do that. `checkDistanceFail()` runs on every
pointer move, and when the gesture is already active it calls `cancel()`.

So on web, moving past `maxDistance` while holding ends the press. **Native is
unverified**, and RNGH's documentation says travel is allowed there, so this may
be a genuine platform split.

The practical cost: **hold-then-drag does not work on web at the default
`maxDistance`.** The drag's own movement cancels the press it is gated on. Raise
`maxDistance` explicitly for that pattern rather than relying on the documented
behaviour.

## Coexistence on web

A relation needs a ref that carries a `handlerTag`, and that rule comes from
RNGH's shared code rather than its platform code. A relation against React
Native's `ScrollView` is therefore a no-op on web **and** on native.

See [Coexistence](/coexistence) for the working form.

## Known unknowns

These are open questions, recorded so the list is honest rather than empty.

- **Touch screens and trackpads.** The pass above used a mouse. A trackpad and
  a touch screen have not been checked.
- **The browser's own gestures.** Text selection, press-and-hold context menus,
  and pull-to-refresh all compete for the same input. No intent has been
  checked against them.
- **Mobile browsers.** Nothing has been checked on iOS Safari or Android
  Chrome, which are the browsers most likely to differ.
- **The jsdom test per intent.** Principle 8 asks for one per intent. None
  exists.

## How to run the survey

```bash
pnpm run example:web
```

Then open each screen and record what happens. Write what you saw. An intent
you did not test is unverified, not working.
