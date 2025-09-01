import React from "react";

export default function Word(props) {

console.log("translations from props are : ", props.translation, "&", props.furigana);


  if (props.type === "word") {
    return (
      <span onClick={() => props.handleSwipe(props.id)}>
        {props.showFurigana && !props.showTranslation
          ? <ruby>{props.kanji}<rt>{props.furigana}</rt></ruby>
        : 
            props.showFurigana && props.showTranslation ? 
                  <ruby>{props.kanji}<rt>{props.furigana}, {props.translation}</rt></ruby> 
        :
           props.kanji}
      </span>
    );
  } else {
    return <span>{props.value}</span>;
  }
}


/**
// simple version to test basic function
export default function Word(props) {
  return (
    <span onClick={() => props.handleSwipe(props.id)}>
      {props.kanji}
      
    </span>
  );
}
**/