import fetch from 'node-fetch';
import withCookies from 'fetch-cookie';

const fetchWithCookies = withCookies(fetch);

async function fetchCVEBaseScore(cveId) {
	try {
		const apiUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveID=${cveId}`;
		console.log('Fetching base score for CVE ID:', cveId);
		console.log('API URL:', apiUrl);

		const response = await fetchWithCookies(apiUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch NVD API data for CVE ID: ${cveId}`);
		}
		const data = await response.json();
		console.log('API response:', data);

		if (data.vulnerabilities && data.vulnerabilities.length > 0) {
			const baseScore = data.vulnerabilities[0].metrics.cvssMetricV2[0].cvssData.baseScore;
			return baseScore;
		} else {
			throw new Error(`CVE base score not found for CVE ID: ${cveId}`);
		}
	} catch (error) {
		console.error(`Error fetching base score for CVE ID: ${cveId}: ${error.message}`);
		return null;
	}
}

// Test the function with a sample CVE ID
fetchCVEBaseScore('CVE-2020-28493')
	.then((baseScore) => console.log('Base score:', baseScore))
	.catch((error) => console.error('Error:', error));
