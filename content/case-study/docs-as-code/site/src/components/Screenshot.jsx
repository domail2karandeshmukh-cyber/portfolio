// A screenshot in a step: the picture, its alternative text, and a caption that says what to look at.
// Width and height are given so the page doesn't move as the picture loads. On a phone the picture is small, so the
// caption links to the full-size file, which opens at its real size and can be zoomed.
import React from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import Translate from "@docusaurus/Translate";
import styles from "./Screenshot.module.css";

export default function Screenshot({ src, alt, caption, width = 1280, height = 800 }) {
  const url = useBaseUrl(src);
  return (
    <figure className={styles.shot}>
      <img src={url} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
      {caption && (
        <figcaption>
          {caption}{" "}
          <a href={url} className={styles.open}><Translate id="screenshot.open">Open full size</Translate></a>
        </figcaption>
      )}
    </figure>
  );
}
