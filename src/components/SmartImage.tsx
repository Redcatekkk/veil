import { useEffect, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { imageSrc } from "../lib/images";

interface SmartImageProps {
  sources: string[];
  className?: string;
}

function SmartImage({ sources, className }: SmartImageProps) {
  const key = sources.join("|");
  const [prevKey, setPrevKey] = useState(key);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  if (key !== prevKey) {
    setPrevKey(key);
    setIndex(0);
    setLoaded(false);
  }

  const src = index < sources.length ? imageSrc(sources[index]) : null;

  useEffect(() => {
    if (!src || loaded) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), 8000);
    return () => clearTimeout(timer);
  }, [src, loaded]);

  return (
    <div className={`smart-image${className ? " " + className : ""}`}>
      <div className={`smart-image-spin${loaded ? " hidden" : ""}`}>
        <CircleNotch size={16} className="spin" />
      </div>
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setIndex((i) => i + 1)}
          className={loaded ? "loaded" : ""}
        />
      )}
    </div>
  );
}

export default SmartImage;
