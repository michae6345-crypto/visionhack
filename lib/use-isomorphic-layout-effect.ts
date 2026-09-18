import { useEffect, useLayoutEffect } from "react";

/**
 * useLayoutEffect on the client, useEffect on the server.
 *
 * Used by the animated readouts (components/CountUp.tsx,
 * components/StatRing.tsx) to solve one specific problem: a number that
 * animates up from zero must still be CORRECT in the server-rendered HTML.
 * Starting the state at zero ships "0%" to anything that has not hydrated yet,
 * which on a readiness ring reads as a failing store rather than an unfinished
 * animation.
 *
 * So the value starts at its real figure and is reset to the animation's
 * starting point on the client — in a layout effect, which runs before the
 * browser paints, so nobody sees the true number flash and then drop to zero.
 *
 * React warns about useLayoutEffect during server rendering, hence the swap.
 */
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
