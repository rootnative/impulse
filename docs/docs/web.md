---
id: web
title: Web behaviour
description: What each Impulse intent does on react-native-web, and what has not been checked yet.
---

# Web behaviour

Web is a platform, not a footnote. RNGH's web implementation differs from its
native one. This page exists so that you don't discover that in each project.

:::note What "verified" means here

We ran each verified row in a desktop browser against the example app. We
didn't check the rows marked **unverified**, and they are not claims.

:::

## Status by intent

| Intent | Activation criteria honoured | Behaviour in a browser |
| --- | --- | --- |
| `useTap` | Yes, verified in RNGH's source | **Works** |
| `useDoubleTap` | Yes, verified in RNGH's source | **Works** |
| `useLongPress` | Yes, verified in RNGH's source | **Works**, with two limits below |
| `useDrag` | Yes, verified in RNGH's source | **Works** |
| `usePan` | Yes, verified in RNGH's source | **Unverified** |
| `useSwipe` | Yes, verified in RNGH's source | **Unverified** |
| `usePinch` | No criteria to honour | **Unverified**, and a trackpad can't drive it. See below |
| `useRotate` | No criteria to honour | **Unverified**, and a trackpad can't drive it. See below |

The first four intents recognize correctly under a mouse on web. We didn't run
the last four in a browser, so their rows are not claims.

## A mouse cannot drive a two-finger intent

RNGH recognizes pinch and rotation from pointer events, so both need **two
pointers**: a touchscreen, or a device that reports them. One mouse is one
pointer, so neither hook fires under it at all.

A trackpad doesn't close the gap. Its pinch arrives as a `wheel` event with
`ctrlKey`, and its rotation arrives as a platform gesture event. Neither is a
pointer pair, so neither reaches these hooks. So a desktop browser with only a
trackpad can't zoom or turn.

Give both a control that writes `scale` or `angle` directly. The accessibility
fallbacks of [`usePinch`](/use-pinch#accessibility) and
[`useRotate`](/use-rotate#accessibility) need that control anyway. The
browser's own page zoom is unaffected in both cases.

We read this in RNGH's web implementation and didn't measure it. That is why
the two rows above still say unverified.

## The cancel path reports on the JS thread

We found this during the web pass, and it is **not a web-specific problem**.
It behaves the same on a device.

Hold a `useLongPress` past `minDuration`. Then move the pointer more than
`maxDistance` (10 points by default) without a release. RNGH cancels the
press, and `onLongPressEnd` reports it:

```tsx
const hold = useLongPress({
  onLongPress: () => setPhase('held'),
  onLongPressEnd: (event, { cancelled }) => {
    setPhase(cancelled ? 'cancelled' : 'released')
  },
})
```

Every end callback works this way: `onTap`, `onDoubleTap`, `onLongPressEnd`,
and `onDragEnd`. Each fires on both endings, and `cancelled` says which. See
[the cancel path](/use-long-press#the-cancel-path) for the full contract.

Before this argument existed, only `onFinalize` reported a cancel, and
`onFinalize` is a worklet. So a screen that held its phase in React state had
to write `'worklet'` plus `scheduleOnRN` by hand. That is the ceremony that
Impulse exists to remove, and it is gone.

`onFinalize` is unchanged. It fires for every touch that reached the view,
recognized or not. That makes it the right place to undo what `onBegin` set.

## `useLongPress` cancels on travel, against RNGH's own contract

RNGH documents `maxDist` as bounding the wait only — *"if the finger travels
further than the defined distance **and the handler hasn't yet activated**, it
will fail"*. A recognized press should tolerate travel.

Its web implementation doesn't do that. `checkDistanceFail()` runs on every
pointer move, and when the gesture is already active, it calls `cancel()`.

So on web, a move past `maxDistance` during a hold ends the press. **Native is
unverified.** RNGH's documentation says travel is allowed there, so this may
be a real platform split.

The practical cost: **hold-then-drag doesn't work on web at the default
`maxDistance`.** The movement of the drag cancels the press that gates it.
Raise `maxDistance` explicitly for that pattern. Don't rely on the documented
behaviour.

## Coexistence on web

A relation needs a ref that carries a `handlerTag`, and that rule comes from
RNGH's shared code, not its platform code. So a relation against React
Native's `ScrollView`, or Gesture Handler 3's own `ScrollView`, does nothing
on web **and** on native.

See [Coexistence](/coexistence) for the working form.

## Known unknowns

These are open questions. We record them so the list is honest, not empty.

- **Touch screens and trackpads.** The pass above used a mouse. We didn't
  check a trackpad or a touch screen.
- **The browser's own gestures.** Text selection, press-and-hold context menus,
  and pull-to-refresh all compete for the same input. We checked no intent
  against them.
- **Mobile browsers.** We checked nothing on iOS Safari or Android Chrome, and
  those are the browsers most likely to differ.
- **The jsdom test per intent.** Principle 8 asks for one per intent. None
  exists.

## How to run the survey

```bash
pnpm run example:web
```

Then open each screen. Record what happens. An intent that you didn't test is
unverified, not working.
