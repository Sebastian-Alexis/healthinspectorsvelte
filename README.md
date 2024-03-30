## SecureOSS: Unmasking Cybersecurity Vulnerabilities in Direct and Transitive OSS Dependencies

**SecureOSS** is a cybersecurity product that scans software projects to identify vulnerabilities in both direct and transitive open-source software (OSS) dependencies. It generates a detailed Software Bill of Materials (SBOM) and utilizes the National Vulnerability Database (NVD) to assess the severity of vulnerabilities, providing developers with actionable insights to secure their software supply chain.

### Features

* **Comprehensive Dependency Analysis:** Identifies both direct and transitive dependencies.
* **Efficient Vulnerability Scanning:** Utilizes multithreading and caching for fast scans.
* **SBOM Generation:** Creates a detailed SBOM in CycloneDX format.
* **Real-time CVE Data:** Retrieves the latest vulnerability information from the NVD.
* **Vulnerability Scoring:** Provides an overall risk assessment based on CVSS scores.
* **Detailed Reporting:** Generates reports with dependency tree visualization.

### Benefits

* **Improved Software Supply Chain Security:** Helps identify and mitigate vulnerabilities in OSS dependencies by providing SBOMs in the Cyclone DX format.
* **Reduced Risk of Cyber Attacks:** Proactive vulnerability management minimizes attack surface.
* **Enhanced Compliance:** SBOM generation facilitates compliance with security standards.
* **Increased Transparency:** Provides clear visibility into software dependencies and vulnerabilities.
* **Streamlined Development Process:** Automates vulnerability scanning and SBOM generation.

### How it Works

1. **User Interface:** Submit your software repository URL for analysis.
2. **Dependency Parser:** SecureOSS identifies both direct and transitive dependencies.
3. **SBOM Generation:** An SBOM is generated in CycloneDX format.
4. **Concurrency Manager:** Vulnerability checks are performed in parallel using multithreading.
5. **NVD API Interface:** Vulnerability data is retrieved from the NVD.
6. **Cache Manager:** Frequently accessed NVD data is cached for efficiency.
7. **Rate Limiter:** Ensures compliance with NVD API usage policies.
8. **Vulnerability Scoring:** Average CVSS score is calculated for overall risk assessment.
9. **Detailed Output:** A report with SBOM, vulnerabilities, and dependency tree is generated.

![Project Flowchart](https://cdn.discordapp.com/attachments/750817240043094099/1223486180125970472/Screenshot_on_2024-03-29_at_21.17.08.png?ex=661a074c&is=6607924c&hm=3e1b247c4d7ccc522a687e7f760b96e2ab5b03871b4b4827b22b4bde4f726704&)

### Installation and Usage

1. Clone the repository: `git clone https://github.com/your-username/SecureOSS.git`
2. Install dependencies: `npm install`
3. Run the application: `npm start`
4. Submit your software repository URL for analysis.

### Contributing

This project is currently being registered in ISEF 2024, so contribution cannot currently be accepted. Please email sebastianralexis@gmail.com for further inquires.

### License

This project is licensed under the MIT License. See the `LICENSE` file for details.
