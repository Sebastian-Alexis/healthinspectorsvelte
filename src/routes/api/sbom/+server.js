import fs from 'node:fs';
import path from 'path';
import { execSync } from 'node:child_process';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';  // Ensure node-fetch is installed in your environment
import { version } from 'node:process';

// Helper function to check vulnerabilities
async function checkVulnerabilities(library, version) {
    try {
        const requestBody = {
            version: version,
            package: {
                name: library,
                ecosystem: 'PyPI'
            }
        };
        console.log("checking osv api for", library, version)
        const response = await fetch('https://api.osv.dev/v1/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const vulnerabilityData = await response.json();  // Contains vulnerability information
        console.log('Vulnerability Data:', vulnerabilityData);
        
        if (vulnerabilityData && vulnerabilityData.vulns && vulnerabilityData.vulns.length === 0) {
            console.log(`No vulnerabilities found for ${library}`);
        }
        
        return vulnerabilityData;  // Ensure it always returns the data, handling empty or error states within the function
    } catch (error) {
        console.error(`Error checking vulnerabilities for ${library}: ${error}`);
        return { vulns: [] };  // Safeguard: Return empty vulnerabilities array on error
    }
}

function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Function to call the libraries.io API
async function getlibinfo(library, version) {
    const apiKeyList = ['7165ca9cc733d1abd00a87a930d9d714', '10b8f9c2a81b273a6c0db61fb96fb212', '53d6ec55fcbfdedb9ac6bd44ae42050c']; // List of API keys
    let response;
    let homepage;

    // Iterate through the API key list
    for (const apiKey of apiKeyList) {
        const requestUrl = `https://libraries.io/api/pypi/${library}/${version}/dependencies?api_key=${apiKey}`;
        try {
            response = await fetch(requestUrl);
            if (response.ok) {
                break; // Stop iterating if the request is successful
            }
        } catch (error) {
            console.error(`Error calling Libraries.io API: ${error}`);
        }
    }

    if (!response || !response.ok) {
        console.error(`Failed to call Libraries.io API for ${library}@${version}`);
        return null;
    }

    const data = await response.json();

    // Call the API again to get the homepage as a string
    // Call the API again to get the homepage as a string
    const homepageRequestUrl = `https://pypi.org/pypi/${library}/json`;
    try {
        const homepageResponse = await fetch(homepageRequestUrl);
        if (homepageResponse.ok) {
            const homepageText = await homepageResponse.text();
            const lines = homepageText.split('\n');
    
            let fallbackHomepage = ''; // Fallback URL in case the primary search fails
    
            lineLoop: for (let line of lines) {
                let startIndex = 0;
                while ((startIndex = line.indexOf('https://github.com/', startIndex)) !== -1) {
                    const issuesEndIndex = line.indexOf('/issues', startIndex);
                    if (issuesEndIndex !== -1 && issuesEndIndex - startIndex <= 50) {
                        homepage = line.substring(startIndex, issuesEndIndex);
                        console.log(`Homepage found: ${homepage}`);
                        break lineLoop;  // Break out of the loop once a match is found
                    }
    
                    // Prepare for fallback by looking for any GitHub URL ending with a quotation mark
                    const genericEndIndex = line.indexOf('"', startIndex + 19); // +19 to move past "https://github.com/"
                    if (genericEndIndex !== -1 && fallbackHomepage === '') { // Only set fallback if not already found
                        fallbackHomepage = line.substring(startIndex, genericEndIndex);
                    }
    
                    startIndex += 'https://github.com/'.length; // Move startIndex forward to continue searching the line
                }
            }
    
            // If the primary search didn't result in finding the homepage, use the fallback URL
            if (!homepage && fallbackHomepage) {
                homepage = fallbackHomepage;
                console.log(`Fallback homepage found: ${homepage}`);
            }
        } else {
            console.error(`HTTP error on fetching homepage: ${homepageResponse.status}`);
        }
    } catch (error) {
        console.error(`Error fetching PyPI API for homepage: ${error}`);
    }


    if (!homepage) {
        console.error("Homepage not found");
    }

    return homepage ? { ...data, homepage } : null;
}



// Helper function to get CVE details from NVD
async function getCveDetails(library, cve, resultsFolderPath, version) {
    const cveFilePath = path.join(resultsFolderPath, `${library}@${version}_${cve}.json`);
    // Check if CVE data is already cached
    if (fs.existsSync(cveFilePath)) {
        console.log(`Loading cached CVE data for ${library}@${version}_${cve}`);
        return JSON.parse(fs.readFileSync(cveFilePath, 'utf8'));
    }
    console.log(`Fetching data for CVE ${library}@${version}_${cve}...`);
    let attempt = 1;
    while (attempt <= 50) {
        try {
            console.log(`Fetching data for CVE ${library}@${version}_${cve} (Attempt ${attempt})...`);
            const apiUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveID=${cve}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            // Cache the new CVE data
            fs.writeFileSync(cveFilePath, JSON.stringify(data));
            console.log(`Cached new CVE data for ${library}@${version}_${cve} at ${cveFilePath}`);
            return data;
        } catch (error) {
            console.error(`Error fetching data for CVE ${library}@${version}_${cve}: ${error}`);
            attempt++;
            await new Promise(resolve => setTimeout(resolve, 6000 * attempt)); // Pause for 6000 ms multiplied by the attempt number
        }
    }

    console.error(`Exceeded maximum number of attempts for CVE ${library}@${version}_${cve}`);
    return null;  // Return null if max attempts exceeded
}



// SvelteKit uses this export pattern for handling requests
export async function GET({ url }) {
	const repoUrl = url.searchParams.get('repoUrl');
    console.log("repoUrl", repoUrl)

   
    console.log('Generating SBOM...');

    try {
        const baseDirectory = dirname(fileURLToPath(import.meta.url));
        const sourceCodeDirectory = path.join('C:\\Users\\sebas\\Programming\\healthinspectorsvelte\\src\\routes\\api\\dependencies\\sourcecode');
        const cacheDirectory = path.join(baseDirectory, 'cache');
        const resultsFolderPath = path.join(baseDirectory, 'dependencies', 'results');
        if (!fs.existsSync(resultsFolderPath)) {
            fs.mkdirSync(resultsFolderPath, { recursive: true });
        }

        const directories = fs.readdirSync(sourceCodeDirectory, { withFileTypes: true })
                              .filter(dirent => dirent.isDirectory())
                              .map(dirent => dirent.name);

        console.log('Directories:', directories);

        if (directories.length === 0) {
            console.error('No directories found.');
            return new Response('No source code directories found', { status: 404 });
        }

        const selectedDirectory = directories[0];
        const cachePath = path.join(cacheDirectory, `${selectedDirectory}.json`);
        console.log('Directory:', selectedDirectory);

        // Check if data is cached
        if (fs.existsSync(cachePath)) {
            console.log('Loading data from cache...');
            const cachedData = fs.readFileSync(cachePath, 'utf8');
            return new Response(cachedData, {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const sourceCodePath = path.join(sourceCodeDirectory, selectedDirectory);
        console.log('Source Code Directory:', sourceCodePath);

        // Capture the output of cdxgen command
        const output = execSync(`cdxgen -o ${path.join(sourceCodePath, 'bom.json')} -p --author SecureOSS`, {
            cwd: sourceCodePath,
            encoding: 'utf8', // Make sure to return a string
            stdio: 'pipe' // Capture stdout and stderr
        });

        // Extract and clean the dependency tree from the output
        const treeStart = output.indexOf('pkg:');
        const treeEnd = output.lastIndexOf('pkg') + 'pkg'.length + output.substring(output.lastIndexOf('pkg') + 'pkg'.length).indexOf('\n');
        let tree = output.substring(treeStart, treeEnd)
                           .replace(/Dependency Tree/g, '')
                           .replace(/[║╔╚╗╝═╟╢]/g, '')
                           .replace(/Generated with ♥ by cdxgen/g, '')
                           .trim(); // Preserve original tree structure for display

        // Parsing library names and version numbers for API use
        const parsedTree = tree.replace(/[║╔╚╗╝─═╟╢├└]/g, '').replace(/ +/g, ' '); // Simplify tree for parsing
        const lines = parsedTree.split('\n').map(line => line.trim()).filter(line => line);
        const libraryVersions = lines.slice(1).reduce((acc, line) => {  // Skip the first line (repo name)
            const parts = line.match(/pkg:pypi\/(.+?)@(.+)/);
            if (parts) {
                const [, library, version] = parts;
                acc[library] = version;
            }
            return acc;
        }, {});

        // Check for vulnerabilities and enrich library information
        for (const library in libraryVersions) {
            const version = libraryVersions[library];
            const vulnData = await checkVulnerabilities(library, version);
            const vulns = vulnData.vulns || [];
            const cveDetails = await Promise.all(
                vulns.map(v => v.aliases ? v.aliases.filter(alias => alias.startsWith('CVE-')) : [])
                .flat()
                .map(cve => getCveDetails(library, cve, resultsFolderPath, version))
            );


            // Extract and attach CVE IDs and base scores
            libraryVersions[library] = {
                version,
                vulnerabilities: cveDetails.map(cve => {
                    const baseScore = cve && cve.result && cve.result.CVE_Items[0] && cve.result.CVE_Items[0].impact && cve.result.CVE_Items[0].impact.baseMetricV3 && cve.result.CVE_Items[0].impact.baseMetricV3.cvssV3 ? cve.result.CVE_Items[0].impact.baseMetricV3.cvssV3.baseScore : 'N/A';
                    return { cve: cve && cve.result && cve.result.CVE_data_meta ? cve.result.CVE_data_meta.ID : 'Unknown CVE', baseScore };
                })
            };
        }

        console.log('Libraries and Versions:', libraryVersions);

        // Check and read SBOM file
        const sbomPath = path.join(sourceCodePath, 'bom.json');
        if (!fs.existsSync(sbomPath)) {
            console.log('SBOM file not found', { status: 404 });
            return new Response('SBOM file not found', { status: 404 });
        }
        const sbomString = fs.readFileSync(sbomPath, 'utf8');
        const sbomJson = JSON.parse(sbomString);

        const libraryNamesAndVersions = Object.entries(libraryVersions).map(([name, version]) => `${name}@${version.version}`);
        console.log('Library Names and Versions:', libraryNamesAndVersions);

		// Check if each library name has a CVE in the results folder
        const cveFiles = libraryNamesAndVersions.map(library => {
            const cveFilePaths = fs.readdirSync(resultsFolderPath).filter(file => file.startsWith(`${library}_CVE-`) && file.endsWith('.json'));
            if (cveFilePaths.length > 0) {
                console.log(`Found ${cveFilePaths.length} files for ${library}`);
                return cveFilePaths.map(cveFile => path.join(resultsFolderPath, cveFile));
            } else {
                console.log(`No files found for ${library}`);
                return [];
            }
        });

		console.log('CVE Files:', cveFiles);




        const baseScores = [];
        cveFiles.forEach(cveFilePaths => {
            cveFilePaths.forEach(cveFilePath => {
                const cveFileContent = fs.readFileSync(cveFilePath, 'utf8');
                const baseScoreIndex = cveFileContent.indexOf('"baseScore":');
                if (baseScoreIndex !== -1) {
                    const baseScoreStartIndex = baseScoreIndex + '"baseScore":'.length;
                    const baseScoreEndIndex = cveFileContent.indexOf(',', baseScoreStartIndex);
                    const baseScore = cveFileContent.substring(baseScoreStartIndex, baseScoreEndIndex).trim();
                    baseScores.push(parseFloat(baseScore));
                }
            });
        });
        console.log('Base Scores:', baseScores);




        // Create a list of all the base scores in each CVE found for a specific project

        const libraryCVEs = {};
        const libraryNames = Object.keys(libraryVersions);
        const baseCvePath = 'C:\\Users\\sebas\\Programming\\healthinspectorsvelte\\src\\routes\\api\\sbom\\dependencies\\results';

        libraryNames.forEach(library => {
            const currentVersion = libraryVersions[library].version;  // Get the current version from libraryVersions
            const cveFiles = fs.readdirSync(baseCvePath); // Read all files in the CVE directory
            const cvePaths = cveFiles.filter(cveFile => {
                const fileNameParts = cveFile.split('@');  // Split the file name to get the library name and the rest
                const fileLibraryName = fileNameParts[0];
                const versionAndCve = fileNameParts[1].split('_');  // Split to separate version and CVE
                const fileLibraryVersion = versionAndCve[0];
                return fileLibraryName === library && fileLibraryVersion === currentVersion && cveFile.endsWith('.json');
            });
            const cves = cvePaths.map(cvePath => {
                const cveFileName = path.basename(cvePath, '.json');
                const cve = cveFileName.substring(cveFileName.lastIndexOf('_') + 1);
                return {
                    cve: cve,
                    version: currentVersion  // Use the version from libraryVersions
                };
            });
            if (cves.length > 0) {
                libraryCVEs[library] = cves;
            }
        });

        
        
        console.log(libraryCVEs);

        // Split the tree into lines
        let treeLines = tree.split('\n');

        // For each line in the tree
        for (let i = 0; i < treeLines.length; i++) {
            // For each library in libraryCVEs
            for (const library in libraryCVEs) {
                // If the line contains the library name
                if (treeLines[i].includes(library)) {
                    // Append the CVEs to the end of the line
                    const cves = libraryCVEs[library].map(cve => cve.cve).join(', ');
                    treeLines[i] += ' ' + cves;
                }
            }
        }

        // Join the lines back into a single string
        tree = treeLines.join('\n');
        // Package response content



        // Count the number of vulnerabilities
        const numVulnerabilities = cveFiles.reduce((acc, cveFilePaths) => {
            return acc + cveFilePaths.length;
        }, 0);

        console.log('Number of Vulnerabilities:', numVulnerabilities);

        // Calculate the average score
        let averageScore = 0;
        if (baseScores.length > 0) {
            averageScore = (baseScores.reduce((sum, score) => sum + score, 0) / baseScores.length).toFixed(1);
        }
        console.log('Average Score:', averageScore);



        const numLibraries = (tree.match(/pkg/g) || []).length;
        console.log('Number of Libraries:', numLibraries);

        
        // Count the number of vulnerability-free libraries
        const numVulnerabilityFreeLibraries = treeLines.reduce((count, line) => {
            if (line.includes('pkg') && !line.includes('CVE')) {
                return count + 1;
            }
            return count;
        }, 0);

        console.log('Number of Vulnerability-Free Libraries:', numVulnerabilityFreeLibraries);

        // Calculate the average score of the entire project
        let averageProjectScore = 0;
        console.log("num vulnerabilities for average project socre", numVulnerabilities)
        console.log("num libraries that are secure", numVulnerabilityFreeLibraries)
        if (numVulnerabilities > 0) {
            const secureProjects = numLibraries - numVulnerabilityFreeLibraries;
            console.log('Secure Projects:', secureProjects);
            const cveScores = baseScores.concat(Array(secureProjects).fill(0));
            console.log('CVE Scores:', cveScores);
            
            averageProjectScore = (cveScores.reduce((sum, score) => sum + score, 0) / cveScores.length).toFixed(1);
        }
        console.log('Average Project Score:', averageProjectScore);

        // Add additional metrics to the response content

        // Add additional metrics to the response content
        averageProjectScore = isNaN(averageProjectScore) ? 0 : averageProjectScore;
        console.log("tree", tree)
        const responseContent = {
            sbom: sbomJson,
            cleanedDependencyTree: tree,  // Original tree for display
            libraryVersions: libraryVersions,
            numberOfBaseScores: numVulnerabilities,
            baseScores: baseScores,
            averageBaseScore: averageScore,
            averageProjectScore: averageProjectScore
        };


        // Save response content to cache
        if (!fs.existsSync(cacheDirectory)) {
            fs.mkdirSync(cacheDirectory);
        }

            

        const communityReport = Object.fromEntries(Object.entries(libraryVersions).map(([library, version]) => [library, { version: version.version, published_at: null, license: null, latest_stable_release_published_at: null, latest_stable_release_number: null, versions_behind: 0, development_activity: { commit_frequency: null } }]));
        console.log('Community Report:', communityReport);
        responseContent.communityReport = communityReport;

        // Get list of libraries and versions
        const librariesAndVersions = Object.entries(libraryVersions).map(([library, version]) => ({ library, version: version.version })).slice(1); // Skip the first element

        // Call library info for each library
        for (const { library, version } of librariesAndVersions) {
            const libraryInfo = await getlibinfo(library, version);
            // Process the library info
            if (libraryInfo) {
                console.log('homepage', libraryInfo.homepage);
                const libraryInfoString = JSON.stringify(libraryInfo);
                const searchString = `{"number":"${version}","published_at":`;
                const startIndex = libraryInfoString.indexOf(searchString);
                if (startIndex !== -1) {
                    // Process the library info
                    const endIndex = libraryInfoString.indexOf('}', startIndex) + 1;
                    const libraryInfoJSON = libraryInfoString.substring(startIndex, endIndex);
                    const libraryInfoObject = JSON.parse(libraryInfoJSON);
                    // Do something with the library info
                    console.log(`Library Info for ${library}@${version}:`, libraryInfoObject);
                    communityReport[library].published_at = libraryInfoObject.published_at;
                    communityReport[library].license = libraryInfoObject.original_license;
                }

                // Search for latest stable release published at
                const latestStableReleaseIndex = libraryInfoString.indexOf('"latest_stable_release_published_at":');
                if (latestStableReleaseIndex !== -1) {
                    const startIndex = latestStableReleaseIndex + '"latest_stable_release_published_at":'.length;
                    const endIndex = libraryInfoString.indexOf(',', startIndex);
                    const latestStableReleasePublishedAt = libraryInfoString.substring(startIndex, endIndex).replace(/"/g, '');
                    communityReport[library].latest_stable_release_published_at = latestStableReleasePublishedAt;
                }
                // Search for latest stable release number
                const latestStableReleaseNumberIndex = libraryInfoString.indexOf('"latest_stable_release_number":');
                if (latestStableReleaseNumberIndex !== -1) {
                    const startIndex = latestStableReleaseNumberIndex + '"latest_stable_release_number":'.length;
                    const endIndex = libraryInfoString.indexOf(',', startIndex);
                    const latestStableReleaseNumber = libraryInfoString.substring(startIndex, endIndex).replace(/"/g, '');
                    communityReport[library].latest_stable_release_number = latestStableReleaseNumber;
                }
                // Extract version info between installed version and latest version
                const versionInfoStartIndex = libraryInfoString.indexOf(searchString);
                const versionInfoEndIndex = libraryInfoString.indexOf(`{"number":"${communityReport[library].latest_stable_release_number}"`);
                if (versionInfoStartIndex !== -1 && versionInfoEndIndex !== -1) {
                    const versionInfo = libraryInfoString.substring(versionInfoStartIndex, versionInfoEndIndex);
                    // Count versions that do not contain letters
                    const versionPattern = /"number":"([^"]+)"/g;
                    let match;
                    let count = 0;
                    while ((match = versionPattern.exec(versionInfo)) !== null) {
                        count++;
                    }
                    communityReport[library].versions_behind = count;
                }

                // Parse homepage into author and name
                const url = new URL(libraryInfo.homepage);
                const [, author, name] = url.pathname.split('/');
                console.log('Author:', author, 'name:', name);

                // Run gh api command with retry
                let retryCount = 0;
                const maxRetries = 5;
                const retryDelay = 1000; // 1 second

                const runGhApiCommand = () => {

                    const calculateDaysClosed = (createdAt, closedAt) => {
                        const date1 = new Date(createdAt);
                        const date2 = new Date(closedAt);
                        const diffTime = Math.abs(date2 - date1);
                        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Convert milliseconds to days
                    };

                    exec(`gh api -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" /repos/${author}/${name}/stats/commit_activity`, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`exec error: ${error}`);
                            if (retryCount < maxRetries) {
                                retryCount++;
                                console.log(`Retrying... (Attempt ${retryCount})`);
                                setTimeout(runGhApiCommand, retryDelay);
                            } else {
                                console.error(`Failed to run gh api command after ${maxRetries} attempts.`);
                            }
                            return;
                        }

                        // Parse stdout as JSON
                        const commitData = JSON.parse(stdout.replace('Commit frequency: ', ''));

                        // Check if commitData is an array
                        if (!Array.isArray(commitData)) {
                            console.error('Unexpected data from gh api command:', commitData);
                            if (retryCount < maxRetries) {
                                retryCount++;
                                console.log(`Retrying... (Attempt ${retryCount})`);
                                setTimeout(runGhApiCommand, retryDelay);
                            }
                            console.log('not retrying', retryCount, maxRetries)
                            return;
                        }

                        // Sum up all the 'total' fields
                        const commitFreq = commitData.reduce((total, item) => total + item.total, 0);

                        console.log(`Total commits: ${commitFreq}`);

                        

                        // Run gh api command for issues
                        exec(`gh api -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" "/repos/${author}/${name}/issues?state=all&per_page=100"`, (error, stdout, stderr) => {                            if (error) {
                                console.error(`exec error: ${error}`);
                                return;
                            }
                        
                            // Parse stdout as JSON
                            let issueData;
                            try {
                                issueData = JSON.parse(stdout);
                            } catch (e) {
                                console.error('Error parsing JSON:', e);
                                if (retryCount < maxRetries) {
                                    retryCount++;
                                    execCommand();
                                }
                                
                                return;
                            }
                    
                            // Check if issueData is an array
                            if (!Array.isArray(issueData)) {
                                console.error('Unexpected data from gh api command:', issueData);
                                if (retryCount < maxRetries) {
                                    retryCount++;
                                    console.log(`Retrying... (Attempt ${retryCount})`);
                                    execCommand();
                                }
                                console.log('not retrying', retryCount, maxRetries)
                                return;
                            }

                            let totalDaysClosed = 0;
                            let closedIssuesCount = 0;
                            issueData.forEach(issue => {
                                if (issue.state === 'closed' && issue.created_at && issue.closed_at) {
                                    const daysClosed = calculateDaysClosed(issue.created_at, issue.closed_at);
                                    console.log(`Issue #${issue.number} was closed in ${daysClosed} days.`);
                                    totalDaysClosed += daysClosed;
                                    closedIssuesCount++;
                                }
                            });

                            const averageTimeToClose = closedIssuesCount > 0 ? totalDaysClosed / closedIssuesCount : 0;
                            console.log(`Average time to close: ${averageTimeToClose} days`);

                            if (averageTimeToClose !== undefined) {
                                if (communityReport[library] && communityReport[library].development_activity) {
                                    if (!communityReport[library].development_activity.issue_metrics) {
                                        communityReport[library].development_activity.issue_metrics = {};
                                    }
                                    communityReport[library].development_activity.issue_metrics.average_time_to_close = averageTimeToClose;
                                } else {
                                    console.error(`Cannot set average_time_to_close for ${library}, development_activity or issue_metrics is undefined.`);
                                }
                            } else {
                                console.error(`averageTimeToClose is undefined for ${library}`);
                            }


                            // Count the number of open issues
                            const openIssues = issueData.reduce((total, issue) => total + (issue.state === 'open' ? 1 : 0), 0);
                            const closedIssues = issueData.reduce((total, issue) => total + (issue.state === 'closed' ? 1 : 0), 0);

                            console.log(`Open issues: ${openIssues}`);
                            console.log(`Closed issues: ${closedIssues}`);
                        
                            // Check if communityReport[library].development_activity.issue_metrics is defined
                            if (communityReport[library] && communityReport[library].development_activity) {
                                if (!communityReport[library].development_activity.issue_metrics) {
                                    communityReport[library].development_activity.issue_metrics = {};
                                }
                                communityReport[library].development_activity.issue_metrics.open_issues = openIssues;
                                communityReport[library].development_activity.issue_metrics.closed_issues = closedIssues;
                            } else {
                                console.error(`Cannot set open_issues for ${library}, issue_metrics is undefined.`);
                            }
                            fs.writeFileSync(cachePath, JSON.stringify(responseContent), 'utf8');
                        });
                        communityReport[library].development_activity.commit_frequency = commitFreq;
                    });
                };

                runGhApiCommand();

                
            } else {
                console.error(`Failed to get library info for ${library}@${version}`);
            }
        }
        fs.writeFileSync(cachePath, JSON.stringify(responseContent), 'utf8');
        return new Response(JSON.stringify(responseContent), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
                
    } catch (error) {
        console.error('Error:', error);
        return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
