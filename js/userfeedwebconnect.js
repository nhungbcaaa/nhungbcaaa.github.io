var APP_ID = '414066029421126'; //Facebook APP ID
var LIMIT = 250; //Number of records to bring back at any time
var BASEURL = 'https://nhungbcaaa.github.io/' //base url of virtual directory

window.fbAsyncInit = function() {
  FB.init({
    appId: APP_ID, // Tableau Facebook APP ID
    channelUrl: BASEURL + 'channel.html', // Channel File
    status: true, // check login status
    cookie: true, // enable cookies to allow the server to access the session
    xfbml: true // parse XFBML
  });

  FB.Event.subscribe('auth.statusChange', function(response) {
    if (response.status === 'connected') {
      document.getElementById("message").innerHTML += "<br>Connected to Facebook";
      //SUCCESS
      var str = "<input class='btn btn-dark btn-lg' type='button' value='Get User Feed' onclick='getData(\"" + response.authResponse.accessToken + "\");'/></br></br>";
      document.getElementById("status").innerHTML = str;
    } else if (response.status === 'not_authorized') {
      document.getElementById("message").innerHTML += "<br>Failed to Connect";
      //FAILED
    } else {
      document.getElementById("message").innerHTML += "<br>Logged Out";
      //UNKNOWN ERROR
    }
  });
};
//Facbook Login on Single Page as Tableau does not allow popups
function Login() {
  var uri = window.location.href;
  window.top.location = encodeURI("https://www.facebook.com/dialog/oauth?client_id=" + APP_ID + "&redirect_uri=" + uri + "&response_type=token&scope=user_posts,manage_pages,read_insights,user_friends,user_status,user_photos,user_videos,user_likes,user_hometown,user_birthday,email");
}

//gets top level data about page
function getData(access_token) {
  tableau.connectionData = access_token; // set pageInfo as the connection data so we can get to it when we fetch the data
  tableau.connectionName = 'Facebook User Feed' // name the data source. This will be the data source name in Tableau
  tableau.password = access_token
  tableau.submit();
}

function Logout() {
  FB.logout(function() {
    document.location.reload();
  });
}
(function() {
  //Helper function. Returns property if it exists in data object.
  function ifexists(data, property) {
    var str = property.split('.')[0]; //get top level object

    if (data.hasOwnProperty(str)) {
      var strToRet = data[property.split('.')[0]][property.split('.')[1]]; //return second level object
      return strToRet;
    } else {
      return '';
    }
  }

  function getDataForPage(table, doneCallback, next_page, access_token) {
    FB.api(next_page, {
      access_token: access_token,
      date_format: 'U', //set time format to unicode so that it works with Tableau
      limit: LIMIT
    }, function(feed_response) {
      //console.log(next_page);
      //console.log(feed_response);

      //if no data then we have finished so return empty list to Tableau
      if (feed_response.data.length == 0) {
        doneCallback()
      } else {
        var data = feed_response.data;
        var tableData = []

        // for each post mash the data into an array of objects
        for (ii = 0; ii < data.length; ++ii) {
          //get total comment count
          var totalComments;
          if (data[ii].comments) {
            totalComments = data[ii].comments.summary.total_count;
          }

          //get total like count
          var totalLikes;
          if (data[ii].likes) {
            totalLikes = data[ii].likes.summary.total_count;
          }

          //get created_time
          var created_time;
          if (data[ii].created_time) {
            created_time = new Date(data[ii].created_time * 1000);
          } else {
            created_time = new Date(0);
          }

          //get updated_time
          var updated_time;
          if (data[ii].updated_time) {
            updated_time = new Date(data[ii].updated_time * 1000);
          } else {
            updated_time = new Date(0);
          }

          var entry = {
            'message': data[ii].message,
            'caption': data[ii].caption,
            'created_time': created_time,
            'description': data[ii].description
          };
          tableData.push(entry);
        };

        table.appendRows(tableData)
        var paging_next = feed_response.paging.next; //set next page string
        // Call back to tableau with the table data
        getDataForPage(table, doneCallback, paging_next, access_token)
      }
    });
  }

  var myConnector = tableau.makeConnector();
  myConnector.init = function(initCallback) {
    tableau.authType = tableau.authTypeEnum.custom;

    initCallback();
  };
  myConnector.getSchema = function(schemaCallback) {
    var fieldNames = ['message', 'caption', 'created_time', 'description', 'icon', 'post_id', 'is_expired', 'is_hidden', 'link', 'name', 'picture', 'source', 'status_type', 'subscribed', 'type', 'updated_time', 'application_name', 'application_id', 'from_category', 'from_id', 'from_name', 'Post Shares', 'Post Likes', 'Post Comments (Top Level)'];
    var fieldTypes = ['string', 'string', 'datetime', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'bool', 'string', 'datetime', 'string', 'float', 'string', 'float', 'string', 'float', 'float', 'float'];

    var cols = [{
      id: "message",
      alias: "message",
      dataType: tableau.dataTypeEnum.string
    },
    {
      id: "caption",
      alias: "caption",
      dataType: tableau.dataTypeEnum.string
    },
    {
      id: "created_time",
      alias: "created time",
      dataType: tableau.dataTypeEnum.datetime
    },
    {
      id: "description",
      alias: "description",
      dataType: tableau.dataTypeEnum.string
    }
    ]
    // tableau.headersCallback(fieldNames, fieldTypes); // tell tableau about the fields and their types
    var tableInfo = {
      id: "facebook_user_feed",
      alias: "Facebook user Feed",
      columns: cols
    };
    schemaCallback([tableInfo])
  };

  myConnector.getData = function(table, doneCallback) {
    var access_token = tableau.connectionData;
    var next_page = '/me/feed?fields=likes.limit(1).summary(true), comments.limit(1).summary(true).filter(toplevel), message, caption, created_time, description, icon, id, is_expired, is_hidden, link, name, picture, source, status_type, subscribed, type, updated_time, application, from, shares';

    getDataForPage(table, doneCallback, next_page, access_token)
  };
  tableau.registerConnector(myConnector);
})();
