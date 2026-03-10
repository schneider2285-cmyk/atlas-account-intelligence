import axios from 'axios';

export class LinkupService {
  constructor(private readonly token: string) {}

  async searchProfiles(companyUrl: string, keyword: string) {
    const response = await axios.post('https://api.linkupapi.com/search-profiles', {
      loginToken: this.token,
      companyUrl: [companyUrl],
      keyword,
      totalResults: 20
    });

    return response.data;
  }

  async getProfileInfo(linkedinUrl: string) {
    const response = await axios.post('https://api.linkupapi.com/get-profile-info', {
      loginToken: this.token,
      linkedinUrl
    });

    return response.data;
  }
}
