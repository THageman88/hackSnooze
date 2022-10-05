"use strict";

const BASE_URL = "https://hack-or-snooze-v3.herokuapp.com";

/******************************************************************************
 * Story: a single story in the system
 */

class Story {

  /** Make instance of Story from data object about story:
   *   - {storyId, title, author, url, username, createdAt}
   */

  constructor({ storyId, title, author, url, username, createdAt }) {
    this.storyId = storyId;
    this.title = title;
    this.author = author;
    this.url = url;
    this.username = username;
    this.createdAt = createdAt;
  }

  /** Parses hostname out of URL and returns it. */

  getHostName() { 
    return new URL(this.url).host; // return url from the host
  }
}


/******************************************************************************
 * List of Story instances: used by UI to show story lists in DOM.
 */

class StoryList {
  constructor(stories) {
    this.stories = stories;
  }

  /** Generate a new StoryList. It:
   *
   *  - calls the API
   *  - builds an array of Story instances
   *  - makes a single StoryList instance out of that
   *  - returns the StoryList instance.
   */

  static async getStories() {
    // Note presence of `static` keyword: this indicates that getStories is
    //  **not** an instance method. Rather, it is a method that is called on the
    //  class directly. Why doesn't it make sense for getStories to be an
    //  instance method?

    // query the /stories endpoint (no auth required)
    const response = await axios({
      url: `${BASE_URL}/stories`,
      method: "GET",
    });

    // turn plain old story objects from API into instances of Story class
    const stories = response.data.stories.map(story => new Story(story));

    // build an instance of our own class using the new array of stories
    return new StoryList(stories);
  }

  /** Adds story data to API, makes a Story instance, adds it to story list.
   * - user - the current instance of User who will post the story
   * - obj of {title, author, url}
   *
   * Returns the new Story instance
   */

  async addStory(user, { title, author, url }) { // creates our function to add story
    const token = user.loginToken;//creates token for users
    const response = await axios({ //sends the post to users stories
      method: "POST",
      url: `${BASE_URL}/stories`,
      data: { token, story: { title, author, url } },
    });

    const story = new Story(response.data.story); //says the new story comes from the response data sent in the response variable
    this.stories.unshift(story); // adds it to the top of the story lise
    user.ownStories.unshift(story);

    return story;
  }

  /** Delete story from API and remove from the story lists.
   *
   * - user: the current User instance
   * - storyId: the ID of the story you want to remove
   */

  async removeStory(user, storyId) { //removes stories function
    const token = user.loginToken; //gets the users token
    await axios({
      url: `${BASE_URL}/stories/${storyId}`, //makes the ajax call to delete the story
      method: "DELETE",
      data: { token: user.loginToken }
    });

   
    this.stories = this.stories.filter(story => story.storyId !== storyId); //using the filter function to remove the ids of the stories we want removed


    user.ownStories = user.ownStories.filter(s => s.storyId !== storyId); //we want to be able to do the same thing for the users own stories
    user.favorites = user.favorites.filter(s => s.storyId !== storyId);
  }
}


/******************************************************************************
 * User: a user in the system (only used to represent the current user)
 */

class User {
  /** Make user instance from obj of user data and a token:
   *   - {username, name, createdAt, favorites[], ownStories[]}
   *   - token
   */

  constructor({
                username,
                name,
                createdAt,
                favorites = [],
                ownStories = []
              },
              token) {
    this.username = username;
    this.name = name;
    this.createdAt = createdAt;

    // instantiate Story instances for the user's favorites and ownStories
    this.favorites = favorites.map(s => new Story(s));
    this.ownStories = ownStories.map(s => new Story(s));

    // store the login token on the user so it's easy to find for API calls.
    this.loginToken = token;
  }

  /** Register new user in API, make User instance & return it.
   *
   * - username: a new username
   * - password: a new password
   * - name: the user's full name
   */

  static async signup(username, password, name) {
    const response = await axios({
      url: `${BASE_URL}/signup`,
      method: "POST",
      data: { user: { username, password, name } },
    });

    let { user } = response.data;

    return new User(
      {
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
        favorites: user.favorites,
        ownStories: user.stories
      },
      response.data.token
    );
  }

  /** Login in user with API, make User instance & return it.

   * - username: an existing user's username
   * - password: an existing user's password
   */

  static async login(username, password) {
    const response = await axios({
      url: `${BASE_URL}/login`,
      method: "POST",
      data: { user: { username, password } },
    });

    let { user } = response.data;

    return new User(
      {
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
        favorites: user.favorites,
        ownStories: user.stories
      },
      response.data.token
    );
  }

  /** When we already have credentials (token & username) for a user,
   *   we can log them in automatically. This function does that.
   */

  static async loginViaStoredCredentials(token, username) {
    try {
      const response = await axios({
        url: `${BASE_URL}/users/${username}`,
        method: "GET",
        params: { token },
      });

      let { user } = response.data;

      return new User(
        {
          username: user.username,
          name: user.name,
          createdAt: user.createdAt,
          favorites: user.favorites,
          ownStories: user.stories
        },
        token
      );
    } catch (err) {
      console.error("loginViaStoredCredentials failed", err);
      return null;
    }
  }

//createsfavorites

  async addFavorite(story) { // creates the addFavorite function which creates
    this.favorites.push(story); //push storie to favorites
    await this._addOrRemoveFavorite("add", story) //wait unttill user specifies add or remove
  }

  /** Remove a story to the list of user favorites and update the API
   * - story: the Story instance to remove from favorites
   */

  async removeFavorite(story) { //creates the remove function for favorites
    this.favorites = this.favorites.filter(stor => stor.storyId !== story.storyId); //filters it out of sotries
    await this._addOrRemoveFavorite("remove", story);//removes it 
  }

  /** Update API with favorite/not-favorite.
   *   - newState: "add" or "remove"
   *   - story: Story instance to make favorite / not favorite
   * */

  async _addOrRemoveFavorite(newState, story) { //add or remove story function
    const method = newState === "add" ? "POST" : "DELETE"; // variable that handles the the decsions of adding or removing
    const token = this.loginToken; ///token for users
    await axios({
      url: `${BASE_URL}/users/${this.username}/favorites/${story.storyId}`, //retrieves the user data stored from the favorites 
      method: method,
      data: { token },
    });
  }

  /** Return true/false if given Story instance is a favorite of this user. */

  isFavorite(story) { //is favorited
    return this.favorites.some(s => (s.storyId === story.storyId)); // returns favorites
  }
}