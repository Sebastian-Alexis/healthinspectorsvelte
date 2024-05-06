import fs from 'node:fs';
import path from 'path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';  // Ensure node-fetch is installed in your environment

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
        console.log('Vulnerability Data:', library);
        
        if (vulnerabilityData && vulnerabilityData.vulns && vulnerabilityData.vulns.length === 0) {
            console.log(`No vulnerabilities found for ${library}`);
        }
        
        return vulnerabilityData;  // Ensure it always returns the data, handling empty or error states within the function
    } catch (error) {
        console.error(`Error checking vulnerabilities for ${library}: ${error}`);
        return { vulns: [] };  // Safeguard: Return empty vulnerabilities array on error
    }
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
export async function GET() {
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
        const treeStart = output.indexOf('pkg');
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

		// Separate library name and CVE
        const libraryCVEs = {};
        const libraryNames = Object.keys(libraryVersions);
        libraryNames.forEach(library => {
            const cvePaths = cveFiles.find(cveFile => cveFile.includes(library));
            if (cvePaths) {
            const cves = cvePaths.map(cvePath => {
                const cveFileName = path.basename(cvePath, '.json');
                const cve = cveFileName.substring(cveFileName.lastIndexOf('_') + 1);
                return cve;
            });
            libraryCVEs[library] = cves;
            }
        });

        console.log('Library CVEs:', libraryCVEs);

		// Split the tree into lines
		let treeLines = tree.split('\n');

		// For each line in the tree
		for (let i = 0; i < treeLines.length; i++) {
			// For each library in libraryCVEs
			for (const library in libraryCVEs) {
				// If the line contains the library name
				if (treeLines[i].includes(library)) {
					// Append the CVEs to the end of the line
					treeLines[i] += ' ' + libraryCVEs[library].join(', ');
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
        if (numVulnerabilities > 0) {
            const secureProjects = numLibraries - numVulnerabilityFreeLibraries;
            const cveScores = baseScores.concat(Array(secureProjects).fill(0));
            averageProjectScore = (cveScores.reduce((sum, score) => sum + score, 0) / cveScores.length).toFixed(1);
        }
        console.log('Average Project Score:', averageProjectScore);

        // Add additional metrics to the response content

        // Add additional metrics to the response content
        averageProjectScore = isNaN(averageProjectScore) ? 0 : averageProjectScore;

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
