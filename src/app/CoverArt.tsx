"use client";

import { useState } from "react";
import { PawMark } from "./paw";

/**
 * Cover image that shows a faint paw placeholder until the image loads
 * (or permanently, if there's no image). Fill a positioned, sized parent.
 */
export function CoverArt({
  src,
  alt,
  objectPosition,
  phSize = "46%",
}: {
  src: string | null;
  alt: string;
  objectPosition?: string;
  phSize?: number | string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <span className="cover-ph" hidden={!!src && loaded}>
        <PawMark size={phSize} />
      </span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="cover-img"
          src={src}
          alt={alt}
          loading="lazy"
          style={{ opacity: loaded ? 1 : 0, objectPosition }}
          onLoad={() => setLoaded(true)}
        />
      )}
    </>
  );
}
