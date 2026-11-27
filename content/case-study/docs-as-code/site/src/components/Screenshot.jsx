// A screenshot in a step: the picture, its alternative text, and a caption that says what is marked.
// Width and height are given so the page doesn't move as the picture loads.
import React from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from "./Screenshot.module.css";

export default function Screenshot({ src, alt, caption, width = 1280, height = 800 }) {
  return (
    <figure className={styles.shot}>
      <img src={useBaseUrl(src)} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
