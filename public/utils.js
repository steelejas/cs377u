export function test () {
  console.log("TEST CALLED!!!!!");
}

export function localStorageTest() {
  localStorage.setItem("testKey", "testVal");
}

function logout2() {
  // Show confirmation dialog
  var confirmLogout = confirm("Hey! Are you sure you want to log out?");
          
  if (confirmLogout) {
      document.cookie.split(";").forEach(function(c) {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      localStorage.clear();
      window.location.href = '/';
  } else {
      // If user cancels, do nothing
      return;
  }
}