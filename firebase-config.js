// Firebase web app configuration. These values identify the project and are
// intended for browser use; protect the database with Firebase Security Rules.
(function () {
  var firebaseConfig = {
    apiKey: "AIzaSyBfVHqdx8VDfRqwRRqJ0OJu6gDe6aMdmoQ",
    authDomain: "mess-management-99b1c.firebaseapp.com",
    projectId: "mess-management-99b1c",
    storageBucket: "mess-management-99b1c.firebasestorage.app",
    messagingSenderId: "986453360314",
    appId: "1:986453360314:web:897814f43de30ae75bcc83"
  };

  if (!window.firebase) return;
  if (!window.firebase.apps.length) window.firebase.initializeApp(firebaseConfig);
})();
