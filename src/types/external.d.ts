declare module '@react-native-firebase/firestore' {
  const firestore: any;
  export default firestore;
}

declare module 'react-native-webview' {
  import * as React from 'react';
  export class WebView extends React.Component<any> {}
}
