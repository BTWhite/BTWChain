# BTWChain

Bitcoin White is an efficient, flexible, and safe decentralized application platform designed to lower the threshold for developers. Using JavaScript as the programming language and relational database to store data, Bitcoin White is increasing the similarities between developing a DAPP and a traditional web application. Bitcoin White appeals to both developers and businesses because it offers a strong platform where prosperousness of the "ecology" has direct relation with the developer's productivity. Bitcoin White is open in design and can be customized for many uses including finance, document storage, and copyright certificates. The APIs are underlying and abstract, and they can be combined freely to achieve a variety of applications. Bitcoin White has implemented an inherited and enhanced the DPOS algorithm, greatly reducing the probability of forking and risk of double spending. Bitcoin White's side chain, i.e. the application mode, not only delays the expansion of the blockchain but also makes DAPPs more flexible and personalized. Bitcoin White is a forward-looking, low-cost and one-stop application solution.

Linux system required

Public IP address required

Ubuntu 16.04 64bit OS recommended

Above dual-core CPU recommended

Above 2 GB RAM recommended

Above 2MB bandwidth recommended

# Install dependency package 
sudo apt-get install curl sqlite3 ntp wget git libssl-dev openssl make gcc g++ autoconf automake python build-essential -y 
# libsodium for ubuntu 16.04 
sudo apt-get install libtool libtool-bin -y 
 
# Install nvm 
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash 
# This loads nvm 
export NVM_DIR="$HOME/.nvm" 
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion 
 
# Install node and npm for current user. 
nvm install node 8 
# check node version and it should be v8.x.x 
node --version 

# Install node packages 
npm install

# After all package installing run node
node app.js
